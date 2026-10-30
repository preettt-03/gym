import { ChatType, MessageType, Prisma, Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/middlewares/errorHandler';
import { PaginationParams } from '@/lib/pagination';

const GLOBAL_ROOM_SLUG = 'global';

export async function getOrCreateGlobalRoom() {
  const existing = await prisma.chatRoom.findUnique({ where: { slug: GLOBAL_ROOM_SLUG } });
  if (existing) return existing;

  return prisma.chatRoom.create({
    data: { type: ChatType.GLOBAL, name: 'Global Chat', slug: GLOBAL_ROOM_SLUG },
  });
}

async function isBlockedEitherWay(userAId: string, userBId: string) {
  const block = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: userAId, blockedId: userBId },
        { blockerId: userBId, blockedId: userAId },
      ],
    },
  });
  return Boolean(block);
}

export async function getOrCreateDirectRoom(userId: string, otherUserId: string) {
  if (userId === otherUserId) throw new AppError('Cannot start a direct chat with yourself', 400);

  const otherUser = await prisma.user.findFirst({ where: { id: otherUserId, deletedAt: null } });
  if (!otherUser) throw new AppError('User not found', 404);

  if (await isBlockedEitherWay(userId, otherUserId)) {
    throw new AppError('Cannot start a chat with this user', 403);
  }

  const existing = await prisma.chatRoom.findFirst({
    where: {
      type: ChatType.DIRECT,
      deletedAt: null,
      members: { every: { userId: { in: [userId, otherUserId] } } },
      AND: [{ members: { some: { userId } } }, { members: { some: { userId: otherUserId } } }],
    },
    include: { members: true },
  });
  if (existing && existing.members.length === 2) return existing;

  return prisma.chatRoom.create({
    data: {
      type: ChatType.DIRECT,
      members: { create: [{ userId }, { userId: otherUserId }] },
    },
  });
}

export async function assertRoomAccess(roomId: string, userId: string) {
  const room = await prisma.chatRoom.findFirst({ where: { id: roomId, deletedAt: null } });
  if (!room) throw new AppError('Room not found', 404);

  if (room.type === ChatType.GLOBAL) return room;

  const membership = await prisma.chatRoomMember.findUnique({ where: { roomId_userId: { roomId, userId } } });
  if (!membership) throw new AppError('Forbidden', 403);

  return room;
}

export async function listMyRooms(userId: string) {
  const globalRoom = await getOrCreateGlobalRoom();

  const memberships = await prisma.chatRoomMember.findMany({
    where: { userId, room: { deletedAt: null } },
    include: {
      room: {
        include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } },
      },
    },
  });

  return {
    global: globalRoom,
    channels: memberships
      .filter((m) => m.room.type === ChatType.CHANNEL)
      .map((m) => m.room),
    direct: memberships
      .filter((m) => m.room.type === ChatType.DIRECT)
      .map((m) => ({
        ...m.room,
        otherUser: m.room.members.find((member) => member.userId !== userId)?.user ?? null,
      })),
  };
}

export async function sendMessage(
  userId: string,
  roomId: string,
  input: { type: MessageType; content?: string; mediaUrl?: string }
) {
  if (!input.content && !input.mediaUrl) {
    throw new AppError('Message must have content or media', 400);
  }

  const room = await assertRoomAccess(roomId, userId);

  if (room.type === ChatType.DIRECT) {
    const members = await prisma.chatRoomMember.findMany({ where: { roomId } });
    const otherMember = members.find((m) => m.userId !== userId);
    if (otherMember && (await isBlockedEitherWay(userId, otherMember.userId))) {
      throw new AppError('Cannot send messages to this user', 403);
    }
  }

  const membership = room.type !== ChatType.GLOBAL
    ? await prisma.chatRoomMember.findUnique({ where: { roomId_userId: { roomId, userId } } })
    : null;
  if (membership?.isMuted) throw new AppError('You are muted in this room', 403);

  return prisma.chatMessage.create({
    data: {
      roomId,
      senderId: userId,
      type: input.type,
      content: input.content,
      mediaUrl: input.mediaUrl,
    },
    include: { sender: { select: { id: true, name: true, email: true, photoUrl: true } } },
  });
}

export async function listMessages(roomId: string, userId: string, pagination: PaginationParams, before?: string) {
  await assertRoomAccess(roomId, userId);

  // With a cursor, page backwards from that message; otherwise the newest page.
  let olderThan: Date | undefined;
  if (before) {
    const cursor = await prisma.chatMessage.findFirst({ where: { id: before, roomId }, select: { createdAt: true } });
    if (!cursor) throw new AppError('Message not found', 404);
    olderThan = cursor.createdAt;
  }
  const where: Prisma.ChatMessageWhereInput = { roomId, deletedAt: null, ...(olderThan && { createdAt: { lt: olderThan } }) };

  const [rows, total] = await Promise.all([
    prisma.chatMessage.findMany({
      where,
      skip: before ? 0 : pagination.skip,
      // One extra row tells us whether anything older is left.
      take: pagination.limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { sender: { select: { id: true, name: true, email: true, photoUrl: true } } },
    }),
    prisma.chatMessage.count({ where: { roomId, deletedAt: null } }),
  ]);
  const hasMore = rows.length > pagination.limit;
  const items = rows.slice(0, pagination.limit).reverse();

  return {
    items,
    hasMore,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    },
  };
}

// Read-only preview of the gym-wide room for signed-out visitors. Senders are
// trimmed to name + photo so no contact details leave the API.
const PUBLIC_PREVIEW_LIMIT = 50;

export async function listPublicGlobalMessages() {
  const globalRoom = await getOrCreateGlobalRoom();
  const items = await prisma.chatMessage.findMany({
    where: { roomId: globalRoom.id, deletedAt: null },
    take: PUBLIC_PREVIEW_LIMIT,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      roomId: true,
      senderId: true,
      content: true,
      createdAt: true,
      sender: { select: { id: true, name: true, photoUrl: true } },
    },
  });
  return {
    room: { id: globalRoom.id, name: globalRoom.name },
    items: items.reverse().map((m) => ({ ...m, sender: { ...m.sender, name: m.sender.name ?? 'Member', email: null } })),
  };
}

export async function markRead(roomId: string, userId: string, messageId: string) {
  await assertRoomAccess(roomId, userId);

  await prisma.$transaction([
    prisma.chatMessageRead.upsert({
      where: { messageId_userId: { messageId, userId } },
      update: { readAt: new Date() },
      create: { messageId, userId },
    }),
    // The gym-wide room has no membership rows until someone reads it, so create one to hold their read marker.
    prisma.chatRoomMember.upsert({
      where: { roomId_userId: { roomId, userId } },
      update: { lastReadAt: new Date() },
      create: { roomId, userId, lastReadAt: new Date() },
    }),
  ]);
}

/** Unread messages from others, per room and in total, since the member last read each room. */
export async function getUnreadCounts(userId: string) {
  const [globalRoom, user, memberships] = await Promise.all([
    getOrCreateGlobalRoom(),
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { createdAt: true } }),
    prisma.chatRoomMember.findMany({ where: { userId, room: { deletedAt: null } }, select: { roomId: true, lastReadAt: true, joinedAt: true } }),
  ]);
  const since = new Map(memberships.map((m) => [m.roomId, m.lastReadAt ?? m.joinedAt]));
  // Never-opened "Everyone": count from when they joined the gym, not from the first message ever.
  if (!since.has(globalRoom.id)) since.set(globalRoom.id, user.createdAt);

  const rooms: Record<string, number> = {};
  await Promise.all(
    [...since].map(async ([roomId, after]) => {
      rooms[roomId] = await prisma.chatMessage.count({
        where: { roomId, deletedAt: null, senderId: { not: userId }, createdAt: { gt: after } },
      });
    })
  );
  return { total: Object.values(rooms).reduce((a, b) => a + b, 0), rooms };
}

export async function deleteMessage(userId: string, userRole: Role, messageId: string) {
  const message = await prisma.chatMessage.findFirst({ where: { id: messageId, deletedAt: null } });
  if (!message) throw new AppError('Message not found', 404);

  if (message.senderId !== userId && userRole !== Role.ADMIN) {
    throw new AppError('Forbidden', 403);
  }

  await prisma.chatMessage.update({ where: { id: messageId }, data: { deletedAt: new Date() } });
  return message.roomId;
}

export async function togglePin(messageId: string, isPinned: boolean) {
  const message = await prisma.chatMessage.findFirst({ where: { id: messageId, deletedAt: null } });
  if (!message) throw new AppError('Message not found', 404);

  return prisma.chatMessage.update({ where: { id: messageId }, data: { isPinned } });
}

export async function blockUser(blockerId: string, blockedId: string) {
  if (blockerId === blockedId) throw new AppError('Cannot block yourself', 400);
  await prisma.userBlock.upsert({
    where: { blockerId_blockedId: { blockerId, blockedId } },
    update: {},
    create: { blockerId, blockedId },
  });
}

export async function unblockUser(blockerId: string, blockedId: string) {
  await prisma.userBlock.deleteMany({ where: { blockerId, blockedId } });
}

export async function reportMessage(reportedById: string, messageId: string, reason?: string) {
  const message = await prisma.chatMessage.findFirst({ where: { id: messageId } });
  if (!message) throw new AppError('Message not found', 404);

  return prisma.messageReport.create({ data: { messageId, reportedById, reason } });
}

// --- Admin channel management ---

export async function createChannel(adminId: string, name: string) {
  return prisma.chatRoom.create({
    data: { type: ChatType.CHANNEL, name, createdByAdminId: adminId, members: { create: [{ userId: adminId }] } },
  });
}

export async function addChannelMembers(roomId: string, userIds: string[]) {
  const room = await prisma.chatRoom.findFirst({ where: { id: roomId, type: ChatType.CHANNEL, deletedAt: null } });
  if (!room) throw new AppError('Channel not found', 404);

  await prisma.$transaction(
    userIds.map((userId) =>
      prisma.chatRoomMember.upsert({
        where: { roomId_userId: { roomId, userId } },
        update: {},
        create: { roomId, userId },
      })
    )
  );
}

export async function removeChannelMember(roomId: string, userId: string) {
  await prisma.chatRoomMember.deleteMany({ where: { roomId, userId } });
}

export async function listAllChannels() {
  return prisma.chatRoom.findMany({
    where: { type: ChatType.CHANNEL, deletedAt: null },
    include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } },
    orderBy: { createdAt: 'desc' },
  });
}

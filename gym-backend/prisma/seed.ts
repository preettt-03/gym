import bcrypt from 'bcrypt';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@gym.local';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345';
  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      name: 'Platform Admin',
      role: Role.ADMIN,
      isEmailVerified: true,
    },
  });

  console.log(`Seeded admin user: ${admin.email} (password: ${password})`);

  // A handful of tests (payments, membership-checkout, razorpay-webhook) need
  // at least one active plan to exist — this keeps a fresh database (CI, a new
  // dev machine) test-ready without any manual admin setup first.
  const existingPlan = await prisma.membershipPlan.findFirst({ where: { isActive: true, deletedAt: null } });
  if (!existingPlan) {
    const plan = await prisma.membershipPlan.create({
      data: {
        name: 'Monthly Standard',
        description: '1 month of full gym access.',
        durationDays: 30,
        price: 900,
        benefits: ['Gym access', 'Locker'],
      },
    });
    console.log(`Seeded membership plan: ${plan.name}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

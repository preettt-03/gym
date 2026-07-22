import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, UserMinus, UserPlus } from "lucide-react";
import {
  addChannelMember,
  createChannel,
  listChannels,
  listUsers,
  removeChannelMember,
  type AdminChatChannel,
} from "@/lib/api";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const schema = z.object({ name: z.string().min(1, "Channel name is required") });
type FormValues = z.infer<typeof schema>;

function ChannelCard({ channel }: { channel: AdminChatChannel }) {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: candidates } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: () => listUsers({ search: search || undefined }),
    enabled: search.trim().length >= 2,
  });

  const addMutation = useMutation({
    mutationFn: (userId: string) => addChannelMember(channel.id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-channels"] });
      setSearch("");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeChannelMember(channel.id, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-channels"] }),
  });

  const memberIds = new Set(channel.members.map((m) => m.user.id));

  return (
    <Card className="flex flex-col gap-3">
      <CardTitle>{channel.name}</CardTitle>

      <div className="flex flex-wrap gap-2">
        {channel.members.map((m) => (
          <span
            key={m.user.id}
            className="flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-1 text-xs text-accent"
          >
            {m.user.name ?? m.user.email}
            <button onClick={() => removeMutation.mutate(m.user.id)} aria-label="Remove member">
              <UserMinus className="h-3 w-3" />
            </button>
          </span>
        ))}
        {channel.members.length === 0 && <span className="text-xs text-muted">No members yet.</span>}
      </div>

      <div className="relative">
        <Input placeholder="Search users to add..." value={search} onChange={(e) => setSearch(e.target.value)} />
        {search.trim().length >= 2 && candidates && (
          <div className="glass-card absolute z-10 mt-1 w-full p-1">
            {candidates.items
              .filter((u) => !memberIds.has(u.id))
              .map((u) => (
                <button
                  key={u.id}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-foreground/5"
                  onClick={() => addMutation.mutate(u.id)}
                >
                  <span>{u.name ?? u.email}</span>
                  <UserPlus className="h-3.5 w-3.5 text-accent" />
                </button>
              ))}
            {candidates.items.length === 0 && <div className="px-3 py-2 text-sm text-muted">No matches.</div>}
          </div>
        )}
      </div>
    </Card>
  );
}

export function ChatPage() {
  const queryClient = useQueryClient();
  const { data: channels } = useQuery({ queryKey: ["admin-channels"], queryFn: listChannels });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => createChannel(values.name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-channels"] });
      reset();
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Chat Moderation</h1>
      <p className="mt-1 text-muted">Create channels and manage membership.</p>

      <Card className="mt-6">
        <CardTitle>New channel</CardTitle>
        <form
          className="mt-4 flex gap-3"
          onSubmit={handleSubmit((values) => createMutation.mutate(values))}
        >
          <div className="flex-1">
            <Input placeholder="Channel name" {...register("name")} />
            {errors.name && <p className="mt-1 text-xs text-danger">{errors.name.message}</p>}
          </div>
          <Button type="submit" disabled={createMutation.isPending}>
            <Plus className="h-4 w-4" /> Create
          </Button>
        </form>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {channels?.map((c) => (
          <ChannelCard key={c.id} channel={c} />
        ))}
      </div>
    </div>
  );
}

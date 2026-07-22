import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Send } from "lucide-react";
import { broadcastNotification } from "@/lib/api";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  body: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function NotificationsPage() {
  const [result, setResult] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: broadcastNotification,
    onSuccess: (data) => {
      setResult(`Sent to ${data.notified} user${data.notified === 1 ? "" : "s"}.`);
      reset();
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Notifications</h1>
      <p className="mt-1 text-muted">Broadcast an announcement to all users.</p>

      <Card className="mt-6 max-w-lg">
        <CardTitle>New announcement</CardTitle>
        <CardDescription className="mt-1 mb-4">
          Delivered instantly via realtime push, plus saved to each user&apos;s notification center.
        </CardDescription>

        <form
          className="flex flex-col gap-3"
          onSubmit={handleSubmit((values) => {
            setResult(null);
            mutation.mutate(values);
          })}
        >
          <div>
            <Input placeholder="Title" {...register("title")} />
            {errors.title && <p className="mt-1 text-xs text-danger">{errors.title.message}</p>}
          </div>
          <Input placeholder="Body (optional)" {...register("body")} />
          {result && <p className="text-sm text-accent-2">{result}</p>}
          <Button type="submit" disabled={mutation.isPending}>
            <Send className="h-4 w-4" /> {mutation.isPending ? "Sending..." : "Broadcast"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

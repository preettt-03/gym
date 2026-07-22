import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Bell, BellOff, Send } from "lucide-react";
import { broadcastNotification } from "@/lib/api";
import {
  getCurrentSubscription,
  isPushSupported,
  sendTestPush,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push-client";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  body: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

function TestPushCard() {
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isPushSupported()) {
      setSupported(false);
      setLoading(false);
      return;
    }
    getCurrentSubscription()
      .then((sub) => setSubscribed(Boolean(sub)))
      .finally(() => setLoading(false));
  }, []);

  async function handleToggle() {
    setMessage(null);
    if (subscribed) {
      await unsubscribeFromPush();
      setSubscribed(false);
      return;
    }
    const result = await subscribeToPush();
    if (result.ok) {
      setSubscribed(true);
    } else {
      setMessage(result.reason ?? "Could not enable notifications.");
    }
  }

  async function handleSendTest() {
    setMessage(null);
    const { subscriptionCount } = await sendTestPush();
    setMessage(
      subscriptionCount > 0
        ? "Test push sent — check for a browser notification."
        : "No active subscription to send to. Enable push notifications on this browser first."
    );
  }

  if (!supported || loading) return null;

  return (
    <Card className="mt-6 max-w-lg">
      <CardTitle className="flex items-center gap-2">
        {subscribed ? <Bell className="h-4 w-4 text-accent" /> : <BellOff className="h-4 w-4 text-muted" />}
        Push notifications (this browser)
      </CardTitle>
      <CardDescription className="mt-1 mb-3">
        Subscribe this browser, then send yourself a test push to verify the VAPID setup works end-to-end.
      </CardDescription>
      <div className="flex gap-3">
        <Button variant={subscribed ? "glass" : "default"} size="sm" onClick={handleToggle}>
          {subscribed ? "Disable" : "Enable"}
        </Button>
        <Button variant="glass" size="sm" onClick={handleSendTest} disabled={!subscribed}>
          Send test push
        </Button>
      </div>
      {message && <p className="mt-2 text-xs text-muted">{message}</p>}
    </Card>
  );
}

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

      <TestPushCard />
    </div>
  );
}

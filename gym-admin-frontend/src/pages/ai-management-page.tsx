import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Bot, CheckCircle2 } from "lucide-react";
import { getAiSettings, listAiLogs, updateAiSettings } from "@/lib/ai-api";
import type { AiFeature, AiSettings } from "@/lib/ai-api";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FEATURES: Array<{ key: keyof AiSettings; feature: AiFeature; label: string; description: string }> = [
  {
    key: "workoutPlanEnabled",
    feature: "WORKOUT_PLAN",
    label: "AI Workout Plan Generator",
    description: "Users can generate a workout plan from the exercise library.",
  },
  {
    key: "dietPlanEnabled",
    feature: "DIET_PLAN",
    label: "AI Diet Plan Generator",
    description: "Users can generate a meal plan from the food library.",
  },
  {
    key: "formTipEnabled",
    feature: "FORM_TIP",
    label: "Exercise Form Tips",
    description: "AI-generated form cues on the exercise library.",
  },
  {
    key: "motivationEnabled",
    feature: "MOTIVATION",
    label: "Daily Motivation Messages",
    description: "Personalized motivational message shown on the user dashboard.",
  },
  {
    key: "nutritionSuggestionEnabled",
    feature: "NUTRITION_SUGGESTION",
    label: "Nutrition Suggestions",
    description: "AI feedback on today's logged food vs. the user's goal.",
  },
  {
    key: "chatbotEnabled",
    feature: "CHATBOT",
    label: "AI Coach Chatbot",
    description: "General-purpose fitness/nutrition Q&A chatbot.",
  },
];

function FeatureToggleRow({ item, settings }: { item: (typeof FEATURES)[number]; settings: AiSettings }) {
  const queryClient = useQueryClient();
  const enabled = Boolean(settings[item.key]);

  const mutation = useMutation({
    mutationFn: (next: boolean) => updateAiSettings({ [item.key]: next }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai-settings"] }),
  });

  return (
    <div className="flex items-center justify-between border-b border-foreground/10 py-3 last:border-0">
      <div>
        <div className="text-sm font-medium">{item.label}</div>
        <div className="text-xs text-muted">{item.description}</div>
      </div>
      <Button
        variant={enabled ? "default" : "glass"}
        size="sm"
        onClick={() => mutation.mutate(!enabled)}
        disabled={mutation.isPending}
      >
        {enabled ? "Enabled" : "Disabled"}
      </Button>
    </div>
  );
}

function PromptEditor({ item, settings }: { item: (typeof FEATURES)[number]; settings: AiSettings }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(settings.prompts?.[item.feature] ?? "");
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: () => updateAiSettings({ prompts: { [item.feature]: value } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-settings"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  return (
    <div className="border-b border-foreground/10 py-3 last:border-0">
      <div className="mb-1.5 text-sm font-medium">{item.label} — system prompt</div>
      <textarea
        className="glass-input min-h-[80px] w-full p-3 text-xs outline-none focus:ring-2 focus:ring-accent/50"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Leave blank to use the built-in default prompt"
      />
      <div className="mt-2 flex items-center gap-2">
        <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          Save prompt
        </Button>
        {saved && (
          <span className="flex items-center gap-1 text-xs text-accent-2">
            <CheckCircle2 className="h-3.5 w-3.5" /> Saved
          </span>
        )}
      </div>
    </div>
  );
}

function AiLogsTable() {
  const [feature, setFeature] = useState<AiFeature | undefined>(undefined);
  const { data } = useQuery({
    queryKey: ["ai-logs", feature],
    queryFn: () => listAiLogs({ feature, limit: 20 }),
  });

  return (
    <Card>
      <CardTitle>Recent AI activity</CardTitle>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant={!feature ? "default" : "glass"} size="sm" onClick={() => setFeature(undefined)}>
          All
        </Button>
        {FEATURES.map((f) => (
          <Button
            key={f.feature}
            variant={feature === f.feature ? "default" : "glass"}
            size="sm"
            onClick={() => setFeature(f.feature)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {data?.logs.length === 0 && <p className="text-sm text-muted">No AI activity recorded yet.</p>}
        {data?.logs.map((log) => (
          <div key={log.id} className="rounded-xl border border-foreground/10 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium">{log.feature}</span>
              <span className="text-muted">{new Date(log.createdAt).toLocaleString()}</span>
            </div>
            <div className="mt-1 text-muted">
              {log.user ? `${log.user.name ?? log.user.email}` : "Unknown user"} · {log.model}
              {log.latencyMs != null && ` · ${log.latencyMs}ms`}
            </div>
            {log.errorMessage ? (
              <div className="mt-1 flex items-center gap-1 text-danger">
                <AlertTriangle className="h-3.5 w-3.5" /> {log.errorMessage}
              </div>
            ) : (
              <div className="mt-1 whitespace-pre-line text-foreground/80">
                {log.response?.slice(0, 300)}
                {(log.response?.length ?? 0) > 300 && "..."}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

export function AiManagementPage() {
  const { data } = useQuery({ queryKey: ["ai-settings"], queryFn: getAiSettings });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Bot className="h-6 w-6 text-accent" />
        <h1 className="text-2xl font-semibold">AI Management</h1>
      </div>

      {data && !data.configured && (
        <Card className="border border-yellow-500/30 bg-yellow-500/5">
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            AI features are not configured — set <code className="mx-1 rounded bg-foreground/10 px-1.5">GEMINI_API_KEY</code>{" "}
            in the backend environment to enable them.
          </div>
        </Card>
      )}

      {data && (
        <>
          <Card>
            <CardTitle>Feature toggles</CardTitle>
            <div className="mt-3">
              {FEATURES.map((item) => (
                <FeatureToggleRow key={item.key} item={item} settings={data.settings} />
              ))}
            </div>
          </Card>

          <Card>
            <CardTitle>Prompts</CardTitle>
            <p className="mt-1 text-xs text-muted">
              Override the built-in system prompt per feature. Leave blank to use the default.
            </p>
            <div className={cn("mt-3")}>
              {FEATURES.map((item) => (
                <PromptEditor key={item.key} item={item} settings={data.settings} />
              ))}
            </div>
          </Card>

          <AiLogsTable />
        </>
      )}
    </div>
  );
}

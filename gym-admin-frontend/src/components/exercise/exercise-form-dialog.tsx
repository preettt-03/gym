import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { createExercise, updateExercise, type AdminExercise, type Difficulty, type ExerciseInput } from "@/lib/api";
import { EQUIPMENT_SUGGESTIONS, MUSCLES } from "@/lib/muscles";
import { apiErrorMessage, useToast } from "@/hooks/use-toast";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FieldError, FormAlert } from "@/components/ui/form-message";
import { FieldLabel, GalleryField, ListEditor, TagInput, ThumbnailField, VideoField } from "@/components/exercise/form-fields";

interface FormState {
  name: string;
  targetMuscle: string;
  secondaryMuscles: string[];
  difficulty: Difficulty;
  calories: string;
  equipment: string[];
  description: string;
  instructions: string[];
  commonMistakes: string[];
  coachTip: string;
  thumbnailUrl: string | null;
  images: string[];
  videoUrl: string | null;
}

function initial(ex: AdminExercise | null): FormState {
  return {
    name: ex?.name ?? "",
    targetMuscle: ex?.targetMuscle ?? "",
    secondaryMuscles: ex?.secondaryMuscles ?? [],
    difficulty: ex?.difficulty ?? "BEGINNER",
    calories: ex?.caloriesBurnedEstimate != null ? String(ex.caloriesBurnedEstimate) : "",
    equipment: ex?.equipment ?? [],
    description: ex?.description ?? "",
    // Start new exercises with one empty row so the fields are obvious.
    instructions: ex?.instructions.length ? ex.instructions : [""],
    commonMistakes: ex?.commonMistakes.length ? ex.commonMistakes : [""],
    coachTip: ex?.coachTip ?? "",
    thumbnailUrl: ex?.thumbnailUrl ?? null,
    images: ex?.images ?? [],
    videoUrl: ex?.videoUrl ?? null,
  };
}

type Errors = Partial<Record<"name" | "targetMuscle" | "calories", string>>;

function validate(f: FormState): Errors {
  const errors: Errors = {};
  if (!f.name.trim()) errors.name = "Name is required";
  else if (f.name.trim().length > 120) errors.name = "Keep the name under 120 characters";
  if (!f.targetMuscle) errors.targetMuscle = "Pick the primary muscle";
  if (f.calories.trim()) {
    const n = Number(f.calories);
    if (!Number.isInteger(n) || n < 0 || n > 5000) errors.calories = "Enter a whole number between 0 and 5000";
  }
  return errors;
}

const DIFFICULTIES = [
  { value: "BEGINNER", label: "Beginner" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "ADVANCED", label: "Advanced" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border pt-5 first:border-t-0 first:pt-0">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-gold">{title}</h3>
      {children}
    </section>
  );
}

export function ExerciseFormDialog({ open, exercise, onClose }: { open: boolean; exercise: AdminExercise | null; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(() => initial(exercise));
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const editing = Boolean(exercise);

  useEffect(() => {
    if (open) {
      setForm(initial(exercise));
      setErrors({});
      setServerError(null);
    }
  }, [open, exercise]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const mutation = useMutation({
    mutationFn: () => {
      const clean = (list: string[]) => list.map((s) => s.trim()).filter(Boolean);
      // Editing sends null for emptied fields so they're cleared, not kept.
      const empty = editing ? null : undefined;
      const input: ExerciseInput = {
        name: form.name.trim(),
        targetMuscle: form.targetMuscle,
        secondaryMuscles: form.secondaryMuscles,
        difficulty: form.difficulty,
        caloriesBurnedEstimate: form.calories.trim() ? Number(form.calories) : empty,
        equipment: form.equipment,
        description: form.description.trim() || empty,
        instructions: clean(form.instructions),
        commonMistakes: clean(form.commonMistakes),
        coachTip: form.coachTip.trim() || empty,
        thumbnailUrl: form.thumbnailUrl ?? empty,
        images: form.images,
        videoUrl: form.videoUrl ?? empty,
      };
      return exercise ? updateExercise(exercise.id, input) : createExercise(input);
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["admin-exercises"] });
      queryClient.invalidateQueries({ queryKey: ["admin-exercises-all"] });
      toast.show(editing ? `Updated ${saved.name}` : `Added ${saved.name}`);
      onClose();
    },
    onError: (err) => setServerError(apiErrorMessage(err, "Could not save the exercise")),
  });

  const submit = () => {
    setServerError(null);
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    mutation.mutate();
  };

  // Keep a muscle that isn't in the standard list selectable when editing older data.
  const muscleOptions = [...new Set([...MUSCLES, ...(form.targetMuscle ? [form.targetMuscle] : [])])].map((m) => ({ value: m, label: m }));
  const mediaError = (message: string) => toast.show(message, "error");

  return (
    <Dialog
      open={open}
      onClose={mutation.isPending ? () => {} : onClose}
      size="xl"
      title={editing ? `Edit ${exercise!.name}` : "Add exercise"}
      description="Members see this on the exercise library card and detail page."
      footer={
        <>
          <Button variant="glass" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="exercise-form" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing ? "Save changes" : "Save exercise"}
          </Button>
        </>
      }
    >
      <form
        id="exercise-form"
        noValidate
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Section title="Basics">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="ex-name">Name</FieldLabel>
              <Input
                id="ex-name"
                data-autofocus
                placeholder="e.g. Leg Press"
                value={form.name}
                maxLength={120}
                aria-invalid={errors.name ? true : undefined}
                aria-describedby="ex-name-error"
                onChange={(e) => set("name", e.target.value)}
              />
              <FieldError id="ex-name-error" message={errors.name} />
            </div>
            <div>
              <FieldLabel htmlFor="ex-muscle">Primary target muscle</FieldLabel>
              <Select
                id="ex-muscle"
                value={form.targetMuscle}
                onChange={(v) => set("targetMuscle", v)}
                options={muscleOptions}
                placeholder="Pick a muscle"
                invalid={Boolean(errors.targetMuscle)}
                aria-describedby="ex-muscle-error"
              />
              <FieldError id="ex-muscle-error" message={errors.targetMuscle} />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="ex-secondary" hint="Enter or comma to add">
                Secondary muscles
              </FieldLabel>
              <TagInput
                id="ex-secondary"
                value={form.secondaryMuscles}
                onChange={(v) => set("secondaryMuscles", v)}
                placeholder="e.g. Glutes, Hamstrings"
                suggestions={MUSCLES.filter((m) => m !== form.targetMuscle)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="ex-difficulty">Difficulty</FieldLabel>
              <Select id="ex-difficulty" value={form.difficulty} onChange={(v) => set("difficulty", v as Difficulty)} options={DIFFICULTIES} />
            </div>
            <div>
              <FieldLabel htmlFor="ex-calories" hint="optional">
                Calories burned
              </FieldLabel>
              <Input
                id="ex-calories"
                inputMode="numeric"
                placeholder="kcal per session"
                value={form.calories}
                aria-invalid={errors.calories ? true : undefined}
                aria-describedby="ex-calories-error"
                onChange={(e) => set("calories", e.target.value)}
              />
              <FieldError id="ex-calories-error" message={errors.calories} />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="ex-equipment">Equipment</FieldLabel>
              <TagInput id="ex-equipment" value={form.equipment} onChange={(v) => set("equipment", v)} placeholder="e.g. Leg press machine" suggestions={EQUIPMENT_SUGGESTIONS} />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="ex-description" hint="optional">
                Short description
              </FieldLabel>
              <textarea
                id="ex-description"
                rows={2}
                maxLength={2000}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="One or two lines on what the exercise is for."
                className="glass-input w-full resize-y px-4 py-3 text-sm outline-none placeholder:text-muted focus:border-gold/60 focus:ring-2 focus:ring-gold/25"
              />
            </div>
          </div>
        </Section>

        <Section title="Steps & mistakes">
          {/* Stacked, not side by side: steps run to a sentence or two and need the width. */}
          <div className="grid gap-6">
            <div>
              <FieldLabel>How to do it</FieldLabel>
              <ListEditor label="Step" value={form.instructions} onChange={(v) => set("instructions", v)} placeholder="Describe one step" addLabel="Add step" />
            </div>
            <div>
              <FieldLabel>Common mistakes</FieldLabel>
              <ListEditor label="Mistake" value={form.commonMistakes} onChange={(v) => set("commonMistakes", v)} placeholder="e.g. Locking the knees" addLabel="Add mistake" />
            </div>
            <div>
              <FieldLabel htmlFor="ex-tip" hint="optional · shown in the gold tip card">
                Coach&apos;s tip
              </FieldLabel>
              <textarea
                id="ex-tip"
                rows={2}
                maxLength={1000}
                value={form.coachTip}
                onChange={(e) => set("coachTip", e.target.value)}
                placeholder="e.g. Drive through your heels and keep your lower back on the pad."
                className="glass-input w-full resize-y px-4 py-3 text-sm outline-none placeholder:text-muted focus:border-gold/60 focus:ring-2 focus:ring-gold/25"
              />
            </div>
          </div>
        </Section>

        <Section title="Media">
          <div className="grid gap-5 md:grid-cols-[1fr_1.4fr]">
            <div>
              <FieldLabel>Thumbnail</FieldLabel>
              <ThumbnailField value={form.thumbnailUrl} onChange={(v) => set("thumbnailUrl", v)} onError={mediaError} />
            </div>
            <div>
              <FieldLabel hint="drag & drop · up to 12">Image gallery</FieldLabel>
              <GalleryField value={form.images} onChange={(v) => set("images", v)} onError={mediaError} />
            </div>
            <div className="md:col-span-2">
              <FieldLabel>Video</FieldLabel>
              <VideoField value={form.videoUrl} onChange={(v) => set("videoUrl", v)} onError={mediaError} />
            </div>
          </div>
        </Section>

        <FormAlert message={serverError} />
      </form>
    </Dialog>
  );
}

import bcrypt from 'bcrypt';
import { Difficulty, Prisma, PrismaClient, Role } from '@prisma/client';
import { slugify } from '../src/lib/slug';

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

  // A starter exercise library so the public library and workout plans work
  // on a fresh database (the workout-plan tests need at least one exercise).
  // Upserts by slug and never overwrites exercises an admin has edited.
  let added = 0;
  for (const exercise of STARTER_EXERCISES) {
    const slug = slugify(exercise.name);
    const existing = await prisma.exercise.findUnique({ where: { slug }, select: { id: true } });
    if (existing) continue;
    await prisma.exercise.create({ data: { ...exercise, slug } });
    added++;
  }
  if (added) console.log(`Seeded ${added} starter exercises`);
}

const STARTER_EXERCISES: Omit<Prisma.ExerciseCreateWithoutCategoriesInput, 'slug'>[] = [
  {
    name: 'Barbell Back Squat',
    description: 'The foundational lower-body strength lift.',
    difficulty: Difficulty.INTERMEDIATE,
    targetMuscle: 'Quadriceps',
    secondaryMuscles: ['Glutes', 'Hamstrings', 'Core'],
    equipment: ['Barbell', 'Squat rack'],
    workoutType: 'Strength',
    instructions: [
      'Set the bar on your upper back and step out of the rack with feet shoulder-width apart.',
      'Brace your core and sit your hips back and down until your thighs are at least parallel.',
      'Drive through your whole foot to stand back up, keeping your chest up.',
    ],
    commonMistakes: ['Knees caving inward', 'Heels lifting off the floor', 'Rounding the lower back'],
  },
  {
    name: 'Barbell Bench Press',
    description: 'Classic upper-body pressing movement for chest strength.',
    difficulty: Difficulty.INTERMEDIATE,
    targetMuscle: 'Chest',
    secondaryMuscles: ['Triceps', 'Front deltoids'],
    equipment: ['Barbell', 'Flat bench'],
    workoutType: 'Strength',
    instructions: [
      'Lie on the bench with eyes under the bar and feet flat on the floor.',
      'Grip slightly wider than shoulder width and unrack with straight arms.',
      'Lower the bar to mid-chest under control, then press back up.',
    ],
    commonMistakes: ['Bouncing the bar off the chest', 'Flaring elbows to 90°', 'Lifting hips off the bench'],
  },
  {
    name: 'Conventional Deadlift',
    description: 'Full posterior-chain pull from the floor.',
    difficulty: Difficulty.ADVANCED,
    targetMuscle: 'Hamstrings',
    secondaryMuscles: ['Glutes', 'Lower back', 'Traps', 'Forearms'],
    equipment: ['Barbell'],
    workoutType: 'Strength',
    instructions: [
      'Stand with mid-foot under the bar and grip just outside your legs.',
      'Flatten your back, pull the slack out of the bar and brace.',
      'Push the floor away and stand tall, keeping the bar close to your legs.',
    ],
    commonMistakes: ['Rounding the back', 'Bar drifting away from the body', 'Jerking the bar off the floor'],
  },
  {
    name: 'Pull-Up',
    description: 'Bodyweight vertical pull for back and arm strength.',
    difficulty: Difficulty.INTERMEDIATE,
    targetMuscle: 'Lats',
    secondaryMuscles: ['Biceps', 'Rear deltoids'],
    equipment: ['Pull-up bar'],
    workoutType: 'Strength',
    instructions: [
      'Hang from the bar with an overhand grip slightly wider than shoulders.',
      'Pull your elbows down and back until your chin clears the bar.',
      'Lower all the way to a dead hang under control.',
    ],
    commonMistakes: ['Kipping or swinging', 'Partial range of motion'],
  },
  {
    name: 'Push-Up',
    description: 'Bodyweight press you can do anywhere.',
    difficulty: Difficulty.BEGINNER,
    targetMuscle: 'Chest',
    secondaryMuscles: ['Triceps', 'Shoulders', 'Core'],
    equipment: [],
    workoutType: 'Bodyweight',
    instructions: [
      'Start in a high plank with hands under your shoulders.',
      'Lower your chest to just above the floor, elbows at about 45°.',
      'Press back up while keeping your body in a straight line.',
    ],
    commonMistakes: ['Sagging hips', 'Head dropping forward'],
  },
  {
    name: 'Dumbbell Shoulder Press',
    description: 'Overhead press for shoulder strength and stability.',
    difficulty: Difficulty.BEGINNER,
    targetMuscle: 'Shoulders',
    secondaryMuscles: ['Triceps', 'Upper chest'],
    equipment: ['Dumbbells', 'Bench'],
    workoutType: 'Strength',
    instructions: [
      'Sit tall with dumbbells at shoulder height, palms facing forward.',
      'Press overhead until your arms are straight without locking hard.',
      'Lower back to shoulder height with control.',
    ],
    commonMistakes: ['Arching the lower back', 'Pressing the weights forward instead of up'],
  },
  {
    name: 'Bent-Over Barbell Row',
    description: 'Horizontal pull that builds a thick, strong back.',
    difficulty: Difficulty.INTERMEDIATE,
    targetMuscle: 'Upper back',
    secondaryMuscles: ['Lats', 'Biceps', 'Rear deltoids'],
    equipment: ['Barbell'],
    workoutType: 'Strength',
    instructions: [
      'Hinge at the hips with a flat back, holding the bar at arm’s length.',
      'Row the bar to your lower ribs, squeezing your shoulder blades.',
      'Lower under control without letting your torso rise.',
    ],
    commonMistakes: ['Using momentum', 'Rounding the back'],
  },
  {
    name: 'Walking Lunge',
    description: 'Unilateral leg exercise for strength and balance.',
    difficulty: Difficulty.BEGINNER,
    targetMuscle: 'Quadriceps',
    secondaryMuscles: ['Glutes', 'Hamstrings'],
    equipment: ['Dumbbells'],
    workoutType: 'Strength',
    instructions: [
      'Step forward and lower until both knees are bent about 90°.',
      'Push through the front heel to bring the back leg forward into the next step.',
    ],
    commonMistakes: ['Front knee collapsing inward', 'Steps too short'],
  },
  {
    name: 'Plank',
    description: 'Isometric hold for core strength.',
    difficulty: Difficulty.BEGINNER,
    targetMuscle: 'Core',
    secondaryMuscles: ['Shoulders', 'Glutes'],
    equipment: [],
    workoutType: 'Core',
    durationMinutes: 1,
    instructions: [
      'Rest on your forearms and toes with elbows under shoulders.',
      'Keep a straight line from head to heels and brace your abs.',
      'Breathe steadily and hold for the target time.',
    ],
    commonMistakes: ['Hips sagging or piking up', 'Holding your breath'],
  },
  {
    name: 'Kettlebell Swing',
    description: 'Explosive hip hinge for power and conditioning.',
    difficulty: Difficulty.INTERMEDIATE,
    targetMuscle: 'Glutes',
    secondaryMuscles: ['Hamstrings', 'Core', 'Shoulders'],
    equipment: ['Kettlebell'],
    workoutType: 'Conditioning',
    instructions: [
      'Hike the kettlebell back between your legs with a flat back.',
      'Snap your hips forward to float the bell to chest height.',
      'Let it swing back down and repeat in a smooth rhythm.',
    ],
    commonMistakes: ['Squatting instead of hinging', 'Lifting with the arms'],
  },
  {
    name: 'Lat Pulldown',
    description: 'Machine vertical pull that builds toward pull-ups.',
    difficulty: Difficulty.BEGINNER,
    targetMuscle: 'Lats',
    secondaryMuscles: ['Biceps', 'Rear deltoids'],
    equipment: ['Cable machine'],
    workoutType: 'Strength',
    instructions: [
      'Sit with thighs under the pads and grip the bar wider than shoulders.',
      'Pull the bar to your upper chest, driving elbows down.',
      'Return slowly to full arm extension.',
    ],
    commonMistakes: ['Leaning far back', 'Pulling behind the neck'],
  },
  {
    name: 'Leg Press',
    description: 'Machine compound movement for quads and glutes.',
    difficulty: Difficulty.BEGINNER,
    targetMuscle: 'Quadriceps',
    secondaryMuscles: ['Glutes', 'Hamstrings'],
    equipment: ['Leg press machine'],
    workoutType: 'Strength',
    instructions: [
      'Sit with your back flat on the pad and feet shoulder-width on the platform.',
      'Lower the platform until your knees reach about 90°.',
      'Press back up without locking your knees.',
    ],
    commonMistakes: ['Lower back lifting off the pad', 'Locking the knees at the top'],
  },
];

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

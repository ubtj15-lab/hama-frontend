// prisma/seed.cjs
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  console.log("👟 Running seed (CJS) ...");
  const hashedPassword = await bcrypt.hash("hama1234", 10);

  await prisma.user.upsert({
    where: { email: "admin@hama.local" },
    update: {},
    create: {
      email: "admin@hama.local",
      name: "관리자",
      passwordHash: hashedPassword,
      role: "ADMIN",
    },
  });

  console.log("✅ Admin user ready: admin@hama.local");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("❌ Seed Error:", e);
    prisma.$disconnect();
    process.exit(1);
  });

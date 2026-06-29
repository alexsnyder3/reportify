import bcrypt from 'bcryptjs';
import { prisma } from './prisma.js';
import { logger } from './logger.js';

async function seed() {
  logger.info('Seeding database...');

  // Create org
  const org = await prisma.organization.upsert({
    where: { slug: 'reportify-demo' },
    update: {},
    create: {
      name: 'Reportify Demo Company',
      slug: 'reportify-demo',
    },
  });

  // Create admin user
  const adminHash = await bcrypt.hash('Admin1234!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@reportify.ca' },
    update: {},
    create: {
      organizationId: org.id,
      email: 'admin@reportify.ca',
      passwordHash: adminHash,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
    },
  });

  // Create supervisor user
  const supHash = await bcrypt.hash('Super1234!', 12);
  const supervisor = await prisma.user.upsert({
    where: { email: 'supervisor@reportify.ca' },
    update: {},
    create: {
      organizationId: org.id,
      email: 'supervisor@reportify.ca',
      passwordHash: supHash,
      firstName: 'John',
      lastName: 'Smith',
      role: 'SUPERVISOR',
    },
  });

  // Create sample jobs
  await prisma.job.createMany({
    data: [
      {
        organizationId: org.id,
        name: 'Downtown Office Tower',
        address: '123 Main Street, Vancouver, BC',
        latitude: 49.2827,
        longitude: -123.1207,
        radiusMeters: 300,
      },
      {
        organizationId: org.id,
        name: 'Residential Complex Phase 2',
        address: '456 Oak Avenue, Burnaby, BC',
        latitude: 49.2488,
        longitude: -122.9805,
        radiusMeters: 250,
      },
    ],
    skipDuplicates: true,
  });

  logger.info('Seed complete', {
    orgId: org.id,
    adminEmail: admin.email,
    supervisorEmail: supervisor.email,
  });

  console.log('\n✅ Database seeded successfully!');
  console.log('──────────────────────────────────');
  console.log('Admin login:');
  console.log('  Email:    admin@reportify.ca');
  console.log('  Password: Admin1234!');
  console.log('Supervisor login:');
  console.log('  Email:    supervisor@reportify.ca');
  console.log('  Password: Super1234!');
  console.log('──────────────────────────────────\n');
}

seed()
  .catch((err) => {
    logger.error('Seed failed', { error: String(err) });
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

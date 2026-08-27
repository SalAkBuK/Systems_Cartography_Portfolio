import type { GeneratedOwnerProfile } from '../types';

/**
 * GENERATED OWNER PROFILE.
 *
 * Initial import was reviewed against the owner's LinkedIn profile PDF.
 * Future fork owners regenerate this file with:
 *   npm run setup -- ./imports/linkedin-profile.pdf
 *
 * The source PDF is intentionally not committed.
 */
export const OWNER_PROFILE: GeneratedOwnerProfile = {
  source: {
    kind: 'linkedin_pdf',
    importedAt: '2026-08-27T13:50:00.000Z',
    reviewed: true,
    warnings: [
      'Duplicate certification removed: Google Advanced Data Analytics Specialization',
      'Education entries are retained as raw lines for owner review; the importer does not merge ambiguous school records.'
    ]
  },
  githubTarget: 'https://github.com/SalAkBuK',
  operator: {
    name: 'Salih Bukhari',
    role: 'Full Stack Engineer',
    location: 'Rawalpindi, Punjab, Pakistan',
    focus: 'Full Stack Developer experienced in building scalable web and mobile applications with React, Next.js, React Native, Node.js, NestJS, PostgreSQL, MongoDB, and Prisma.',
    primaryStack: [
      'TypeScript',
      'Prisma ORM',
      'PostgreSQL',
      'React Native',
      'Next.js',
      'Node.js',
      'NestJS',
      'React',
      'MongoDB'
    ],
    systemManifesto: 'Full Stack Developer experienced in building scalable web and mobile applications with React, Next.js, React Native, Node.js, NestJS, PostgreSQL, MongoDB, and Prisma. Passionate about software engineering, AI, and machine learning, with experience across frontend development, backend systems, databases, deployment, and infrastructure. Focused on building reliable products and continuously expanding my technical expertise.',
    contact: {
      email: 'bukharian1776@gmail.com',
      linkedin: 'https://www.linkedin.com/in/salih-bukhari-33439b194/'
    }
  },
  experience: [
    {
      id: 'exp-01-codefier-full-stack-engineer',
      code: 'EXP-01',
      yearRange: 'December 2025 - Present',
      role: 'Full Stack Engineer',
      organization: 'CodeFier',
      location: 'Islāmābād, Pakistan',
      systemDomain: 'Full-Stack Systems',
      keyOutputs: [
        'Promoted from React (Native & JS) Developer to Full Stack Engineer based on contributions across the product stack.',
        'Led development and maintenance of the TowerDesk platform across web applications, mobile applications, backend services, databases, and infrastructure.',
        'Architected and developed a modular monolithic backend, organizing business domains into scalable and maintainable modules to support future platform growth.',
        'Designed and implemented REST APIs, authentication systems, business logic, and database architectures using Next.js, PostgreSQL, MongoDB, and Prisma.',
        'Owned deployment and infrastructure operations, managing AWS EC2 servers, AWS SES email services, PM2-managed backend deployments, Netlify-hosted frontend applications, and production environment configuration.',
        'Worked independently across frontend, backend, mobile development, deployment, and system maintenance throughout the software development lifecycle.'
      ],
      systemsArchitected: [],
      technologies: ['Next.js', 'React', 'PostgreSQL', 'MongoDB', 'Prisma ORM', 'AWS EC2', 'AWS SES', 'PM2', 'Netlify'],
      gridPosition: { x: -140, y: -40 },
      provenance: 'CURATED',
      startDate: '2025-12',
      endDate: null,
      progressionGroup: 'codefier',
      progressionOrder: 2,
      promotionNote: 'PROMOTED FROM PREVIOUS ROLE'
    },
    {
      id: 'exp-02-codefier-react-native-js-developer',
      code: 'EXP-02',
      yearRange: 'September 2025 - November 2025',
      role: 'React (Native & JS) Developer',
      organization: 'CodeFier',
      location: 'Islamabad, Pakistan',
      systemDomain: 'Mobile & Frontend Applications',
      keyOutputs: [
        'Joined CodeFier as a React (Native & JS) Developer, focusing on mobile and frontend application development.',
        'Developed and maintained features using React Native, JavaScript, and modern frontend technologies.',
        'Integrated frontend applications with backend services and APIs to support business workflows.',
        'Collaborated with the development team to deliver production-ready features and improve application performance.',
        'Participated in testing, debugging, and deployment activities across the development lifecycle.'
      ],
      systemsArchitected: [],
      technologies: ['React Native', 'JavaScript', 'React'],
      gridPosition: { x: 0, y: -40 },
      provenance: 'CURATED',
      startDate: '2025-09',
      endDate: '2025-11',
      progressionGroup: 'codefier',
      progressionOrder: 1
    },
    {
      id: 'exp-03-devinity-solutions-web-development-intern-mern-stack',
      code: 'EXP-03',
      yearRange: 'July 2024 - September 2024',
      role: 'Web Development Intern (MERN Stack)',
      organization: 'Devinity Solutions',
      location: 'Islamabad, Pakistan',
      systemDomain: 'Full-Stack Systems',
      keyOutputs: [
        'Developed and maintained web applications using the MERN stack (MongoDB, Express.js, React, and Node.js).',
        'Assisted in full-stack development tasks, including frontend implementation, backend development, and API integration.',
        'Participated in project planning, development, testing, and deployment activities.',
        'Collaborated with team members to deliver project requirements and support seamless feature integration.',
        'Gained hands-on experience with modern web development practices and full-stack application architecture.'
      ],
      systemsArchitected: [],
      technologies: ['Node.js', 'Express.js', 'React', 'MongoDB'],
      gridPosition: { x: 140, y: -40 },
      provenance: 'CURATED',
      startDate: '2024-07',
      endDate: '2024-09'
    }
  ],
  skills: ['TypeScript', 'Prisma ORM', 'PostgreSQL'],
  certifications: [
    'Google IT Automation with Python Specialization',
    'Google Advanced Data Analytics Specialization'
  ],
  education: [
    { raw: 'Capital University of Science & Technology' },
    { raw: 'Undergraduate, Computer Science · (August 2022 - January 2025)' },
    { raw: 'Capital University of Science & Technology (CUST)' },
    { raw: 'Bachelor, Computer Science' }
  ]
};

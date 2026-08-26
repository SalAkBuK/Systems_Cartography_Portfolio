import { OperatorMetadata } from '../types';

/**
 * Fork owners should only need to edit this file and, optionally, .env.
 * Public repository data is loaded automatically from githubTarget.
 */
export const PORTFOLIO_CONFIG: {
  siteId: string;
  pageTitle: string;
  metaDescription: string;
  githubTarget: string;
  templateRepositoryUrl: string;
  contactFormEndpoint: string;
  operator: OperatorMetadata;
} = {
  siteId: 'SALIH.SYSTEMS.PORTFOLIO',
  pageTitle: 'Salih Mohammad Bukhari // Systems Cartography',
  metaDescription: 'Public GitHub systems portfolio of full-stack developer Salih Mohammad Bukhari.',
  githubTarget: 'https://github.com/SalAkBuK',
  templateRepositoryUrl: 'https://github.com/SalAkBuK/Systems_Cartography_Portfolio',
  contactFormEndpoint: (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_CONTACT_FORM_ENDPOINT?.trim() || '',
  operator: {
    name: 'Salih Mohammad Bukhari',
    handle: '@SalAkBuK',
    role: 'Full-Stack Developer',
    location: 'Rawalpindi, Pakistan',
    status: 'GITHUB VERIFIED // AVAILABLE BY INQUIRY',
    focus: 'Product-oriented web and mobile systems spanning frontend, mobile, backend APIs, and data flows.',
    yearsActive: 0,
    commitsIndexed: 'Not indexed',
    productionUptime: 'Not claimed',
    primaryStack: ['JavaScript / TypeScript', 'React', 'React Native', 'Node.js', 'NestJS', 'PostgreSQL'],
    systemManifesto: 'Hands-on developer building modern web and mobile products with React, React Native, Node.js, and NestJS, with a focus on end-to-end product delivery, API design, and scalable backend architecture.',
    contact: {
      email: 'bukharian1776@gmail.com',
      github: 'https://github.com/SalAkBuK',
      linkedin: '',
      pgpKeyId: '',
      pgpFingerprint: '',
      matrix: '',
      availability: 'Contact for current availability'
    }
  }
};

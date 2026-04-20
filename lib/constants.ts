export const DEPTS = [
  "CSAT",
  "Founders Office",
  "Human Resource",
  "Marketing",
  "Product",
  "Sales",
] as const;

export const ROLES = [
  "Asst. Team Lead",
  "BDA",
  "CSAT Executive",
  "Content Writer",
  "Executive Assistant",
  "FD Trainer",
  "FD Trainer Intern",
  "Fashion Model",
  "Graphic Designer",
  "HR Executive",
  "HR Recruiter",
  "Makeup Artist",
  "Social Media Executive",
  "Sr BDA",
] as const;

export const STATUSES = [
  "Applied",
  "Screening",
  "Round 1 - Virtual Interview",
  "Round 2 - Assessment",
  "Final Round",
  "Offer Made",
  "Offer Accepted",
  "Joined",
  "Shortlisted",
  "Interview Scheduled",
  "Call Back",
  "On Hold",
  "Rejected",
  "Rejected (Post-Interview)",
  "Withdrawn",
  "DNP",
] as const;

export const SOURCES = [
  "Direct/Other",
  "Instagram",
  "LinkedIn",
  "LinkedIn Premium",
  "Naukri",
  "Referral",
] as const;

export const OWNERS = [
  "Neha Raghuvanshi",
  "Shreya Jha",
  "Vanshika Rawat",
] as const;

export const LOCATIONS = ["Noida", "Pune", "Indore"] as const;

export const ASSIGNMENT_TYPES = [
  "Written Test",
  "Case Study",
  "Practical Task",
  "Presentation",
  "Other",
] as const;

export const HS_PIPELINE_STAGES = [
  "Applied",
  "Screening",
  "Shortlisted",
  "Interview Scheduled",
  "Call Back",
  "Round 1 - Virtual Interview",
  "Round 2 - Assessment",
  "Final Round",
  "Offer Made",
  "Offer Accepted",
  "Joined",
] as const;

export const HS_ACTIVE_STAGES = [
  "Applied",
  "Screening",
  "Shortlisted",
  "Interview Scheduled",
  "Call Back",
  "Round 1 - Virtual Interview",
  "Round 2 - Assessment",
  "Final Round",
  "Offer Made",
  "Offer Accepted",
] as const;

export const DEFAULT_HIRING_TARGETS: Record<string, { target: number; location: string }> = {
  "Executive Assistant": { target: 3, location: "Noida" },
  "CSAT Executive": { target: 4, location: "Noida" },
  "HR Recruiter": { target: 2, location: "Noida" },
  "HR Executive": { target: 2, location: "Noida" },
  "Asst. Team Lead": { target: 2, location: "Pune" },
  "FD Trainer": { target: 2, location: "Noida" },
  "Social Media Executive": { target: 2, location: "Indore" },
  BDA: { target: 3, location: "Noida" },
  "Graphic Designer": { target: 1, location: "Pune" },
  "Makeup Artist": { target: 2, location: "Noida" },
  "Sr BDA": { target: 2, location: "Noida" },
  "Content Writer": { target: 1, location: "Indore" },
  "Fashion Model": { target: 2, location: "Noida" },
  "FD Trainer Intern": { target: 2, location: "Pune" },
};

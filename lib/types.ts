export type Candidate = {
  id: number;
  date: string;
  candidate: string;
  dept: string;
  role: string;
  source: string;
  owner: string;
  status: string;
  rating: number | null;
  notes: string;
  location: string;
};

export type Offer = {
  id: number;
  name: string;
  role: string;
  dept: string;
  status: string;
  offerdate: string;
  joindate: string;
  notes: string;
};

export type EodReport = {
  id: number;
  date: string;
  recruiter: string;
  location: string;
  resumeShortlisting: {
    profile: string;
    screened: number;
    shortlisted: number;
  };
  screeningCalls: {
    profile: string;
    calls: number;
    shortlisted: number;
  };
  virtualRounds: {
    profile: string;
    rounds: number;
    shortlisted: number;
  };
  assignment: {
    profile: string;
    type: string;
    conducted: number;
    selected: number;
  };
  finalRound: {
    profile: string;
    rounds: number;
    selected: number;
  };
  otherTasks: string;
  submittedAt: string;
};

export type HiringTarget = { target: number; location: string };

export type DashboardState = {
  candidates: Candidate[];
  offers: Offer[];
  eodReports: EodReport[];
  hiringTargets: Record<string, HiringTarget>;
};

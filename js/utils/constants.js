export const STORAGE_KEYS = {
  theme: "barkada-theme",
};

export const PAYMENT_STATUS = {
  NOT_PAID: "Not Paid",
  PENDING: "Pending",
  PAID: "Paid",
  REJECTED: "Rejected",
};

export const APP_PAGES = {
  dashboard: "Dashboard",
  "join-group": "Join Group",
  groups: "Groups",
  "group-details": "Group Details",
  "create-group": "Create Group",
  "edit-group": "Edit Group",
  contributions: "Contributions",
  "recurring-cycle": "Recurring Cycles",
  confirmations: "Confirmations",
  history: "History",
  members: "Members",
  profile: "Profile",
  settings: "Settings",
};

export const NAV_ITEMS = {
  treasurer: [
    { page: "dashboard", label: "Dashboard", href: "../pages/dashboard.html", lane: "Overview", meta: "Progress and next actions", icon: "Home" },
    { page: "groups", label: "Groups", href: "../pages/groups.html", lane: "Groups", meta: "Spaces and join codes", icon: "Grid" },
    { page: "contributions", label: "Contributions", href: "../pages/contributions.html", lane: "Contributions", meta: "Dues and payment rows", icon: "List" },
    { page: "confirmations", label: "Confirmations", href: "../pages/confirmations.html", lane: "Payments", meta: "Review pending claims", icon: "Check" },
    { page: "members", label: "Members", href: "../pages/members.html", lane: "Members", meta: "Roster and status", icon: "Users" },
    { page: "history", label: "History", href: "../pages/history.html", lane: "Reports", meta: "Payment records", icon: "Clock" },
  ],
  member: [
    { page: "dashboard", label: "Dashboard", href: "../pages/dashboard.html", lane: "Overview", meta: "My status and next action", icon: "Home" },
    { page: "groups", label: "Groups", href: "../pages/groups.html", lane: "Groups", meta: "Joined spaces", icon: "Grid" },
    { page: "contributions", label: "Dues", href: "../pages/contributions.html", lane: "Contributions", meta: "Mark and track payments", icon: "List" },
    { page: "history", label: "History", href: "../pages/history.html", lane: "Reports", meta: "My payment records", icon: "Clock" },
  ],
  hybrid: [
    { page: "dashboard", label: "Dashboard", href: "../pages/dashboard.html", lane: "Overview", meta: "Active group context", icon: "Home" },
    { page: "groups", label: "Groups", href: "../pages/groups.html", lane: "Groups", meta: "Mixed memberships", icon: "Grid" },
    { page: "contributions", label: "Contributions", href: "../pages/contributions.html", lane: "Contributions", meta: "Role-aware rows", icon: "List" },
    { page: "confirmations", label: "Confirmations", href: "../pages/confirmations.html", lane: "Payments", meta: "Visible in treasurer groups", icon: "Check" },
    { page: "members", label: "Members", href: "../pages/members.html", lane: "Members", meta: "Visible in treasurer groups", icon: "Users" },
    { page: "history", label: "History", href: "../pages/history.html", lane: "Reports", meta: "Payment records", icon: "Clock" },
  ],
};

export const QUICK_LINKS = [
  { label: "Login", href: "./pages/login.html" },
  { label: "Sign Up", href: "./pages/signup.html" },
  { label: "Join Group", href: "./pages/join-group.html" },
];

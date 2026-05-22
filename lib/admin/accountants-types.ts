/** טיפוסי רשימת רואה חשבון — שניהם בסרבר ובלקוח (ללא שורת server-only) */
export type AccountantListItem = {
  id: string;
  email: string | null;
  displayName: string | null;
  createdAt: string | null;
  clientCount: number;
};

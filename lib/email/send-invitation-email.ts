import "server-only";

import { getEmailSenderDisplayName } from "@/lib/email/email-sender-display-name";
import { sendTransactionalTextEmailSafe } from "@/lib/email/transactional-email";

function greetingLine(inviteeDisplayName: string | null | undefined): string {
  const n = inviteeDisplayName?.trim();
  return n ? `שלום ${n},` : "שלום,";
}

export function buildAccountantInvitationMail(input: {
  inviteeDisplayName: string | null | undefined;
  inviteUrl: string;
}): { subject: string; textBody: string } {
  const sig = getEmailSenderDisplayName();
  const textBody = `${greetingLine(input.inviteeDisplayName)}

קיבלת הזמנה להירשם למערכת לשיתוף קבלות וחשבוניות.

להשלמת ההרשמה יש לפתוח את הקישור בדפדפן (מומלץ מאותו מכשיר שבו תשתמש/י במערכת):
${input.inviteUrl}

הקישור אישי ואינו מיועד להעברה לאחרים.

בברכה,
${sig}`;
  return {
    subject: "הזמנה להצטרפות למערכת שיתוף קבלות",
    textBody,
  };
}

export function buildClientMemberInvitationMail(input: {
  inviteeDisplayName: string | null | undefined;
  accountantDisplayName: string;
  inviteUrl: string;
}): { subject: string; textBody: string } {
  const { accountantDisplayName, inviteUrl } = input;
  const textBody = `${greetingLine(input.inviteeDisplayName)}

הוזמנת על ידי רואה החשבון שלך, ${accountantDisplayName}, להצטרף למערכת לניהול קבלות וחשבוניות.

להשלמת ההרשמה יש לפתוח את הקישור:
${inviteUrl}

הקישור אישי ואינו מיועד להעברה לאחרים, ואין להשתמש בקישור מכתובת מייל אחרת.

בברכה,
${accountantDisplayName}`;

  return {
    subject: `הזמנה מ${accountantDisplayName} להצטרפות למערכת שיתוף קבלות`,
    textBody,
  };
}

export async function sendAccountantInvitationEmail(input: {
  to: string;
  inviteeDisplayName: string | null | undefined;
  inviteUrl: string;
}): Promise<void> {
  const { subject, textBody } = buildAccountantInvitationMail(input);
  await sendTransactionalTextEmailSafe({
    to: input.to,
    subject,
    textBody,
  });
}

export async function sendClientMemberInvitationEmail(input: {
  to: string;
  inviteeDisplayName: string | null | undefined;
  accountantDisplayName: string;
  inviteUrl: string;
}): Promise<void> {
  const { subject, textBody } = buildClientMemberInvitationMail(input);
  await sendTransactionalTextEmailSafe({
    to: input.to,
    subject,
    textBody,
  });
}

export function AccountantUsersPlaceholderPanel() {
  return (
    <div className="w-full max-w-3xl rounded-lg border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-base font-semibold text-zinc-900">ניהול משתמשים</h2>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-600">
        כאן יופיע בהמשך מסך מאוחד לניהול מוזמנים ומשתמשי לקוח (הזמנות, סטטוס הצטרפות
        והרשאות). כרגע ניתן להזמין משתמשים חדשים מתוך{" "}
        <strong className="font-medium text-zinc-800">ניהול תיקים</strong> — עם יצירת
        תיק או מהצעדי ההזמנה לכל תיק.
      </p>
    </div>
  );
}

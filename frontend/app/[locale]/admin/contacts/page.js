"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import Icon from "@/components/Icon";
import { useAuth } from "@/components/AuthProvider";
import { createAPIClient } from "@/lib/api";
import {
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  Select,
  Sheet,
  Skeleton,
  Tabs,
  Textarea,
  ToastProvider,
  useToast,
  cn,
} from "@/components/ui";

const STATUS = ["new", "read", "replied", "archived"];
const PER_PAGE = 20;

const STATUS_META = {
  new:      { tone: "info",    icon: "alertCircle",  fr: "Nouveau",  ar: "جديد" },
  read:     { tone: "neutral", icon: "check",        fr: "Lu",       ar: "مقروء" },
  replied:  { tone: "success", icon: "checkCircle",  fr: "Répondu",  ar: "تم الرد" },
  archived: { tone: "neutral", icon: "trash",        fr: "Archivé",  ar: "مؤرشف" },
};

export default function AdminContactsPage() {
  return (
    <ToastProvider>
      <ContactsInner />
    </ToastProvider>
  );
}

function ContactsInner() {
  const locale = useLocale();
  const ar = locale === "ar";
  const { accessToken } = useAuth();
  const toast = useToast();

  const [contacts, setContacts] = useState([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState("all"); // all | new | read | replied | archived
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(null);
  const [selected, setSelected] = useState(null);
  const [draftNotes, setDraftNotes] = useState("");

  const load = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    try {
      const client = createAPIClient(accessToken);
      const res = await client.getAdminContacts(page, filter === "all" ? "" : filter);
      setContacts(res?.data || []);
      setTotal(res?.total || 0);
    } catch (err) {
      setError(err?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, filter, page]);

  const update = async (id, data, opts = {}) => {
    if (!accessToken) return;
    setActionLoading(id);
    try {
      const client = createAPIClient(accessToken);
      await client.updateAdminContact(id, data);
      setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, ...data } : c)));
      if (selected?.id === id) setSelected({ ...selected, ...data });
      if (!opts.silent) {
        toast.push({ tone: "success", title: ar ? "تم التحديث" : "Mis à jour" });
      }
    } catch (err) {
      toast.push({ tone: "danger", title: err?.message || "Erreur" });
    } finally {
      setActionLoading(null);
    }
  };

  const remove = async (id) => {
    if (!accessToken) return;
    if (!window.confirm(ar ? "حذف هذه الرسالة نهائياً؟" : "Supprimer ce message définitivement ?")) return;
    setActionLoading(id);
    try {
      const client = createAPIClient(accessToken);
      await client.deleteAdminContact(id);
      setContacts((prev) => prev.filter((c) => c.id !== id));
      setTotal((t) => Math.max(0, t - 1));
      if (selected?.id === id) setSelected(null);
      toast.push({ tone: "success", title: ar ? "تم الحذف" : "Message supprimé" });
    } catch (err) {
      toast.push({ tone: "danger", title: err?.message || "Erreur" });
    } finally {
      setActionLoading(null);
    }
  };

  const openContact = (contact) => {
    setSelected(contact);
    setDraftNotes(contact.admin_notes || "");
    if (contact.status === "new") {
      // Auto-mark as read on open
      update(contact.id, { status: "read" }, { silent: true });
    }
  };

  const saveNotes = async () => {
    if (!selected) return;
    await update(selected.id, { admin_notes: draftNotes });
  };

  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));
  const counts = contacts.reduce((acc, c) => { acc[c.status] = (acc[c.status] || 0) + 1; return acc; }, {});

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <header>
        <Badge variant="secondary" icon="inbox">{ar ? "البريد الوارد" : "Boîte de réception"}</Badge>
        <h1 className="display mt-3 text-3xl sm:text-4xl text-[var(--color-text-strong)]">
          {ar ? "الرسائل" : "Messages"}
        </h1>
        <p className="mt-1.5 text-[15px] text-[var(--color-text-muted)]">
          {ar
            ? "كل ما يصلكم من نموذج الاتصال."
            : "Tous les messages reçus depuis le formulaire de contact."}
        </p>
      </header>

      {/* Filters */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Tabs
          items={[
            { value: "all",      label: `${ar ? "الكل" : "Tous"} (${total})` },
            { value: "new",      label: ar ? "جديد" : "Nouveaux" },
            { value: "read",     label: ar ? "مقروء" : "Lus" },
            { value: "replied",  label: ar ? "تم الرد" : "Répondus" },
            { value: "archived", label: ar ? "مؤرشف" : "Archivés" },
          ]}
          value={filter}
          onChange={(v) => { setFilter(v); setPage(1); }}
        />
        <Button onClick={load} variant="ghost" size="sm" leadingIcon="refresh" loading={loading}>
          {ar ? "تحديث" : "Actualiser"}
        </Button>
      </div>

      {error && <Banner tone="danger" title={ar ? "خطأ" : "Erreur"}>{error}</Banner>}

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} padding="md"><Skeleton height={48} /></Card>
          ))}
        </div>
      ) : contacts.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon="inbox"
            title={ar ? "صندوقك فارغ" : "Boîte vide"}
            description={
              filter === "all"
                ? (ar ? "لا توجد رسائل لعرضها." : "Aucun message à afficher.")
                : (ar ? "لا رسائل بهذا التصفية." : "Aucun message dans ce filtre.")
            }
          />
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden divide-y divide-[var(--color-border-subtle)]">
          {contacts.map((c) => (
            <ContactRow
              key={c.id}
              contact={c}
              ar={ar}
              onOpen={() => openContact(c)}
            />
          ))}
        </Card>
      )}

      {total > PER_PAGE && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-[var(--color-text-muted)]">
            {ar ? "صفحة" : "Page"} <span className="num font-semibold text-[var(--color-text-strong)]">{page}</span> / <span className="num">{pageCount}</span>
          </p>
          <div className="flex gap-2">
            <Button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1 || loading} variant="secondary" size="sm" leadingIcon="chevronLeft">
              {ar ? "السابق" : "Précédent"}
            </Button>
            <Button onClick={() => setPage((p) => p + 1)} disabled={page >= pageCount || loading} variant="secondary" size="sm" trailingIcon="chevronRight">
              {ar ? "التالي" : "Suivant"}
            </Button>
          </div>
        </div>
      )}

      {/* Detail sheet */}
      <Sheet
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.subject || (ar ? "رسالة" : "Message")}
        description={selected?.full_name ? `${selected.full_name} · ${selected.email}` : selected?.email}
        size="lg"
        footer={
          selected && (
            <div className="flex flex-wrap gap-2 items-center justify-between">
              <div className="flex gap-2">
                <a
                  href={`mailto:${selected.email}?subject=Re: ${encodeURIComponent(selected.subject || "")}`}
                  className="inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-[var(--color-primary-600)] text-white text-[15px] font-medium hover:bg-[var(--color-primary-700)] transition-colors"
                >
                  <Icon name="send" className="h-4 w-4 rtl-flip" />
                  {ar ? "رد بالبريد" : "Répondre par email"}
                </a>
                {selected.status !== "replied" && (
                  <Button onClick={() => update(selected.id, { status: "replied" })} variant="secondary" leadingIcon="checkCircle">
                    {ar ? "تم الرد" : "Marquer répondu"}
                  </Button>
                )}
              </div>
              <Button onClick={() => remove(selected.id)} variant="ghost" leadingIcon="trash" className="text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]">
                {ar ? "حذف" : "Supprimer"}
              </Button>
            </div>
          )
        }
      >
        {selected && (
          <ContactDetail
            contact={selected}
            ar={ar}
            actionLoading={actionLoading}
            onUpdate={(data) => update(selected.id, data)}
            draftNotes={draftNotes}
            setDraftNotes={setDraftNotes}
            onSaveNotes={saveNotes}
          />
        )}
      </Sheet>
    </div>
  );
}

function ContactRow({ contact, ar, onOpen }) {
  const meta = STATUS_META[contact.status] || STATUS_META.read;
  const isNew = contact.status === "new";
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "w-full flex items-start gap-3 p-4 text-left rtl:text-right",
        "hover:bg-[var(--color-surface-muted)] transition-colors",
        isNew && "bg-[var(--color-info-bg)]/40"
      )}
    >
      {isNew && <span className="mt-2 h-2 w-2 rounded-full bg-[var(--color-info)] shrink-0" aria-label="unread" />}
      <Avatar name={contact.full_name || contact.email} size="sm" variant={isNew ? "accent" : "neutral"} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3 mb-1">
          <p className={cn(
            "text-sm truncate",
            isNew ? "font-semibold text-[var(--color-text-strong)]" : "font-medium text-[var(--color-text)]"
          )}>
            {contact.full_name || contact.email}
          </p>
          <span className="text-xs text-[var(--color-text-muted)] shrink-0 whitespace-nowrap">
            {contact.created_at
              ? new Date(contact.created_at).toLocaleDateString(ar ? "ar-MA" : "fr-FR", { day: "numeric", month: "short" })
              : ""}
          </span>
        </div>
        <p className={cn(
          "text-[15px] truncate",
          isNew ? "font-medium text-[var(--color-text-strong)]" : "text-[var(--color-text)]"
        )}>
          {contact.subject || (ar ? "بدون موضوع" : "Sans sujet")}
        </p>
        <p className="text-sm text-[var(--color-text-muted)] truncate mt-0.5">
          {contact.message}
        </p>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <Badge variant={meta.tone} icon={meta.icon} size="sm">
            {ar ? meta.ar : meta.fr}
          </Badge>
          {contact.admin_notes && (
            <Badge variant="neutral" icon="edit" size="sm">
              {ar ? "ملاحظة" : "Note"}
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}

function ContactDetail({ contact, ar, actionLoading, onUpdate, draftNotes, setDraftNotes, onSaveNotes }) {
  const busy = actionLoading === contact.id;
  const meta = STATUS_META[contact.status] || STATUS_META.read;
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 flex-wrap">
        <Badge variant={meta.tone} icon={meta.icon}>{ar ? meta.ar : meta.fr}</Badge>
        <span className="text-xs text-[var(--color-text-muted)]">
          {contact.created_at
            ? new Date(contact.created_at).toLocaleString(ar ? "ar-MA" : "fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
            : ""}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <DetailField label={ar ? "الاسم" : "Nom"} value={contact.full_name || "—"} />
        <DetailField
          label="Email"
          value={
            <a href={`mailto:${contact.email}`} className="text-[var(--color-primary-700)] hover:underline break-all">
              {contact.email}
            </a>
          }
        />
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
          {ar ? "الرسالة" : "Message"}
        </h3>
        <div className="rounded-xl bg-[var(--color-surface-sunken)] border border-[var(--color-border)] p-4 text-[15px] text-[var(--color-text)] leading-relaxed whitespace-pre-line">
          {contact.message}
        </div>
      </div>

      <div className="pt-4 border-t border-[var(--color-border-subtle)] space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          {ar ? "حالة الرسالة" : "Statut"}
        </h3>
        <div className="flex flex-wrap gap-2">
          {STATUS.map((s) => {
            const m = STATUS_META[s];
            const active = contact.status === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => onUpdate({ status: s })}
                disabled={busy || active}
                className={cn(
                  "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-sm font-medium border transition-colors",
                  active
                    ? "bg-[var(--color-primary-600)] text-white border-[var(--color-primary-600)]"
                    : "bg-[var(--color-surface)] text-[var(--color-text)] border-[var(--color-border-strong)] hover:bg-[var(--color-surface-muted)]",
                  "disabled:opacity-50"
                )}
              >
                <Icon name={m.icon} className="h-3.5 w-3.5" />
                {ar ? m.ar : m.fr}
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-4 border-t border-[var(--color-border-subtle)] space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          {ar ? "ملاحظات داخلية" : "Notes internes"}
        </h3>
        <Textarea
          value={draftNotes}
          onChange={(e) => setDraftNotes(e.target.value)}
          rows={3}
          placeholder={ar ? "ملاحظة لفريقك..." : "Une note pour votre équipe…"}
        />
        <div className="flex justify-end">
          <Button onClick={onSaveNotes} loading={busy} size="sm" leadingIcon="check">
            {ar ? "حفظ الملاحظة" : "Enregistrer la note"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DetailField({ label, value }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider font-medium text-[var(--color-text-muted)]">{label}</dt>
      <dd className="mt-0.5 text-[15px] text-[var(--color-text-strong)] break-words">{value || "—"}</dd>
    </div>
  );
}

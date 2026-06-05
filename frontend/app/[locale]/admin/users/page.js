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
  Input,
  Select,
  Sheet,
  Skeleton,
  Stat,
  Tabs,
  ToastProvider,
  useToast,
  cn,
} from "@/components/ui";

const PER_PAGE = 20;

export default function AdminUsersPage() {
  return (
    <ToastProvider>
      <UsersInner />
    </ToastProvider>
  );
}

function UsersInner() {
  const locale = useLocale();
  const ar = locale === "ar";
  const { accessToken } = useAuth();
  const toast = useToast();

  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all | active | inactive | admin
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadUsers = async (pageNum = page, q = search) => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    try {
      const client = createAPIClient(accessToken);
      const res = await client.getAdminUsers(pageNum, q);
      setUsers(res?.data || []);
      setTotal(res?.total || 0);
    } catch (err) {
      setError(err?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!accessToken) return;
    loadUsers(page, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, page]);

  const onSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadUsers(1, search);
  };

  const update = async (userId, data) => {
    if (!accessToken) return;
    setActionLoading(userId);
    try {
      const client = createAPIClient(accessToken);
      await client.updateAdminUser(userId, data);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...data } : u)));
      if (detail?.id === userId) setDetail({ ...detail, ...data });
      toast.push({
        tone: "success",
        title: ar ? "تم التحديث" : "Utilisateur mis à jour",
      });
    } catch (err) {
      toast.push({ tone: "danger", title: err?.message || "Erreur" });
    } finally {
      setActionLoading(null);
    }
  };

  const openDetail = async (user) => {
    setDetail(user);
    if (!accessToken) return;
    setDetailLoading(true);
    try {
      const client = createAPIClient(accessToken);
      const full = await client.getAdminUser
        ? await client.getAdminUser(user.id)
        : await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/admin/users/${user.id}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          }).then((r) => r.json());
      setDetail(full);
    } catch {
      // keep the basic data we already have
    } finally {
      setDetailLoading(false);
    }
  };

  // Client-side filter on top of search
  const filtered = users.filter((u) => {
    if (filter === "active") return u.is_active;
    if (filter === "inactive") return !u.is_active;
    if (filter === "admin") return u.role === "admin";
    return true;
  });

  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <Badge variant="accent" icon="users">{ar ? "إدارة" : "Gestion"}</Badge>
          <h1 className="display mt-3 text-3xl sm:text-4xl text-[var(--color-text-strong)]">
            {ar ? "المستخدمون" : "Utilisateurs"}
          </h1>
          <p className="mt-1.5 text-[15px] text-[var(--color-text-muted)]">
            {ar
              ? "إدارة الحسابات، الأدوار وحالة التفعيل."
              : "Gérez les comptes, les rôles et l'activation."}
          </p>
        </div>
        <form onSubmit={onSearch} className="flex gap-2 w-full sm:w-auto">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={ar ? "ابحث بالاسم أو البريد..." : "Nom ou email…"}
            leadingIcon="search"
            className="sm:w-72"
          />
          <Button type="submit" size="md" leadingIcon="search" loading={loading && !!search}>
            {ar ? "بحث" : "Chercher"}
          </Button>
        </form>
      </header>

      {/* Filter bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Tabs
          items={[
            { value: "all", label: `${ar ? "الكل" : "Tous"} (${total})` },
            { value: "active", label: ar ? "نشط" : "Actifs" },
            { value: "inactive", label: ar ? "غير نشط" : "Inactifs" },
            { value: "admin", label: ar ? "مدراء" : "Admins" },
          ]}
          value={filter}
          onChange={setFilter}
        />
        <Button onClick={() => loadUsers(page, search)} variant="ghost" size="sm" leadingIcon="refresh" loading={loading}>
          {ar ? "تحديث" : "Actualiser"}
        </Button>
      </div>

      {error && <Banner tone="danger" title={ar ? "خطأ" : "Erreur"}>{error}</Banner>}

      {/* Table */}
      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-[var(--color-surface-sunken)]">
              <tr>
                <Th>{ar ? "المستخدم" : "Utilisateur"}</Th>
                <Th>{ar ? "البريد" : "Email"}</Th>
                <Th>{ar ? "الدور" : "Rôle"}</Th>
                <Th>{ar ? "الحالة" : "Statut"}</Th>
                <Th>{ar ? "منذ" : "Inscrit"}</Th>
                <Th className="text-end">{ar ? "إجراءات" : "Actions"}</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="px-5 py-3"><Skeleton height={36} /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12">
                    <EmptyState
                      icon="users"
                      title={ar ? "لا مستخدمون" : "Aucun utilisateur"}
                      description={
                        search
                          ? (ar ? "لا نتائج تطابق بحثك." : "Aucun résultat pour votre recherche.")
                          : (ar ? "لم يسجّل أي مستخدم بعد." : "Personne ne s'est encore inscrit.")
                      }
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    ar={ar}
                    actionLoading={actionLoading}
                    onUpdate={update}
                    onOpen={() => openDetail(u)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination */}
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
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail ? (detail.full_name || detail.email) : ""}
        description={detail?.email}
        size="lg"
      >
        {detail && (
          <UserDetail
            user={detail}
            loading={detailLoading}
            ar={ar}
            actionLoading={actionLoading}
            onUpdate={update}
          />
        )}
      </Sheet>
    </div>
  );
}

function Th({ children, className }) {
  return (
    <th className={cn(
      "px-5 py-3.5 text-start text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] whitespace-nowrap",
      className
    )}>
      {children}
    </th>
  );
}

function UserRow({ user, ar, actionLoading, onUpdate, onOpen }) {
  const busy = actionLoading === user.id;
  return (
    <tr className="hover:bg-[var(--color-surface-muted)] transition-colors">
      <td className="px-5 py-3.5">
        <button
          type="button"
          onClick={onOpen}
          className="flex items-center gap-3 group text-left rtl:text-right"
        >
          <Avatar name={user.full_name || user.email} size="sm" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--color-text-strong)] group-hover:text-[var(--color-primary-700)] truncate">
              {user.full_name || <span className="italic text-[var(--color-text-subtle)]">{ar ? "بدون اسم" : "Sans nom"}</span>}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] num truncate">{user.id?.slice(0, 8)}</p>
          </div>
        </button>
      </td>
      <td className="px-5 py-3.5 text-sm text-[var(--color-text)] whitespace-nowrap">{user.email}</td>
      <td className="px-5 py-3.5">
        <Select
          value={user.role || "user"}
          onChange={(e) => onUpdate(user.id, { role: e.target.value })}
          size="sm"
          disabled={busy}
          options={[
            { value: "user", label: ar ? "مستخدم" : "Utilisateur" },
            { value: "admin", label: ar ? "مدير" : "Admin" },
          ]}
        />
      </td>
      <td className="px-5 py-3.5">
        {user.is_active ? (
          <Badge variant="success" icon="checkCircle">{ar ? "نشط" : "Actif"}</Badge>
        ) : (
          <Badge variant="neutral" icon="close">{ar ? "غير نشط" : "Inactif"}</Badge>
        )}
      </td>
      <td className="px-5 py-3.5 text-sm text-[var(--color-text-muted)] whitespace-nowrap">
        {user.created_at
          ? new Date(user.created_at).toLocaleDateString(ar ? "ar-MA" : "fr-FR", { day: "numeric", month: "short", year: "numeric" })
          : "—"}
      </td>
      <td className="px-5 py-3.5 text-end">
        <div className="inline-flex items-center gap-1.5">
          <Button onClick={onOpen} variant="ghost" size="sm" leadingIcon="user">
            {ar ? "تفاصيل" : "Détails"}
          </Button>
          <Button
            onClick={() => onUpdate(user.id, { is_active: !user.is_active })}
            variant={user.is_active ? "secondary" : "primary"}
            size="sm"
            loading={busy}
          >
            {user.is_active ? (ar ? "تعطيل" : "Désactiver") : (ar ? "تفعيل" : "Activer")}
          </Button>
        </div>
      </td>
    </tr>
  );
}

function UserDetail({ user, loading, ar, actionLoading, onUpdate }) {
  const busy = actionLoading === user.id;
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Avatar name={user.full_name || user.email} size="xl" />
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-[var(--color-text-strong)] truncate">
            {user.full_name || user.email}
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] truncate">{user.email}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="primary" icon="shield">{user.role || "user"}</Badge>
            {user.is_active
              ? <Badge variant="success" icon="checkCircle">{ar ? "نشط" : "Actif"}</Badge>
              : <Badge variant="neutral" icon="close">{ar ? "غير نشط" : "Inactif"}</Badge>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card padding="md">
          <Stat
            size="sm"
            label={ar ? "حسابات الري" : "Calculs d'irrigation"}
            value={loading ? "—" : (user.irrigation_count ?? 0)}
          />
        </Card>
        <Card padding="md">
          <Stat
            size="sm"
            label={ar ? "تشخيصات" : "Diagnostics"}
            value={loading ? "—" : (user.disease_count ?? 0)}
          />
        </Card>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          {ar ? "معلومات الحساب" : "Informations"}
        </h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <DetailField label={ar ? "ID" : "ID"} value={<span className="num text-xs">{user.id}</span>} />
          <DetailField
            label={ar ? "منذ" : "Inscrit le"}
            value={
              user.created_at
                ? new Date(user.created_at).toLocaleString(ar ? "ar-MA" : "fr-FR", { day: "numeric", month: "long", year: "numeric" })
                : "—"
            }
          />
          <DetailField
            label={ar ? "آخر تحديث" : "Mis à jour"}
            value={
              user.updated_at
                ? new Date(user.updated_at).toLocaleString(ar ? "ar-MA" : "fr-FR", { day: "numeric", month: "short", year: "numeric" })
                : "—"
            }
          />
          <DetailField label={ar ? "اللغة" : "Langue"} value={user.locale || "fr"} />
        </dl>
      </div>

      <div className="pt-4 border-t border-[var(--color-border-subtle)] space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          {ar ? "إجراءات" : "Actions"}
        </h3>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => onUpdate(user.id, { role: user.role === "admin" ? "user" : "admin" })}
            loading={busy}
            variant="secondary"
            leadingIcon="shield"
          >
            {user.role === "admin"
              ? (ar ? "تعيين كمستخدم" : "Rétrograder en user")
              : (ar ? "تعيين كمدير" : "Promouvoir admin")}
          </Button>
          <Button
            onClick={() => onUpdate(user.id, { is_active: !user.is_active })}
            loading={busy}
            variant={user.is_active ? "danger" : "primary"}
            leadingIcon={user.is_active ? "close" : "check"}
          >
            {user.is_active ? (ar ? "تعطيل الحساب" : "Désactiver") : (ar ? "تفعيل" : "Activer")}
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

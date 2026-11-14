"use client";
import { ReactNode, useEffect, useRef } from "react";
import {
  ArrowUpRight,
  ChevronRight,
  X,
  Inbox,
  LoaderCircle,
} from "lucide-react";
export function StatusBadge({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  const color = [
    "online",
    "healthy",
    "resolved",
    "Received",
    "connected",
  ].includes(status)
    ? "green"
    : ["weak", "warning", "degraded", "acknowledged", "simulated"].includes(
          status,
        )
      ? "amber"
      : ["offline", "critical"].includes(status)
        ? "red"
        : "blue";
  return (
    <span className={`badge ${color}`}>
      <i />
      {label || status}
    </span>
  );
}
export function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {title && (
        <div className="panel-heading">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function PageLink({
  to,
  children,
}: {
  to: string;
  children: ReactNode;
}) {
  return (
    <a className="text-link" href={`#${to}`}>
      {children}
      <ChevronRight size={14} />
    </a>
  );
}
export function KpiCard({
  label,
  value,
  suffix,
  icon,
  foot,
  trend,
  spark,
  color = "green",
}: {
  label: string;
  value: string | number;
  suffix?: string;
  icon: ReactNode;
  foot: ReactNode;
  trend?: string;
  spark?: number[];
  color?: string;
}) {
  return (
    <div className="kpi-card">
      <div className="kpi-top">
        <span>{label}</span>
        <span className={`kpi-icon ${color}`}>{icon}</span>
      </div>
      <div className="kpi-value">
        {value}
        <small>{suffix}</small>
        {spark && (
          <svg className={`kpi-spark ${color}`} viewBox="0 0 110 35">
            <polyline
              points={spark
                .map((v, i) => `${i * (110 / (spark.length - 1))},${35 - v}`)
                .join(" ")}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
            />
          </svg>
        )}
      </div>
      <div className="kpi-foot">
        {foot}
        {trend && (
          <span className="positive">
            <ArrowUpRight size={12} />
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}
export function EmptyState({
  title = "No data to display",
  description = "Connect your gateway or enable Demo Mode to get started.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <Inbox size={30} />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function LoadingState() {
  return (
    <div className="empty-state">
      <LoaderCircle className="spin" size={28} />
      <p>Connecting to your network…</p>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const dialog = ref.current;
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={19} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Meter({
  label,
  value,
  color = "var(--green)",
  detail,
}: {
  label: string;
  value: number;
  color?: string;
  detail?: string;
}) {
  return (
    <div className="meter">
      <div>
        <span>{label}</span>
        <strong>{detail || `${value.toFixed(0)}%`}</strong>
      </div>
      <div className="meter-track">
        <i
          style={{
            width: `${Math.min(100, Math.max(0, value))}%`,
            background: color,
          }}
        />
      </div>
    </div>
  );
}
export function DetailGrid({ items }: { items: [string, ReactNode][] }) {
  return (
    <div className="detail-grid">
      {items.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

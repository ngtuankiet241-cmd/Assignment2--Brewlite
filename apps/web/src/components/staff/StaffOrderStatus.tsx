import { STAFF_STATUSES, type StaffOrderStatus } from '@/types/staff';

export default function StaffOrderStatus({ status }: { status: StaffOrderStatus }) {
  const { label, color } = STAFF_STATUSES[status];
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-bold ${color}`}>{label}</span>;
}

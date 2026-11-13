export function StaffLoadingState() {
  return <div role="status" aria-busy="true" className="space-y-3 py-3"><span className="sr-only">Đang tải giao diện nhân viên...</span>{[1, 2, 3].map((key) => <div key={key} aria-hidden="true" className="h-32 animate-pulse rounded-2xl border border-coffee-100 bg-coffee-100/60" />)}</div>;
}

export function StaffEmptyState({ filtered, onReset }: { filtered: boolean; onReset: () => void }) {
  return <div role="status" className="rounded-2xl border border-dashed border-coffee-300 bg-white p-8 text-center"><span aria-hidden="true" className="text-3xl">☕</span><h2 className="mt-3 font-bold text-coffee-950">{filtered ? 'Không có đơn phù hợp' : 'Chưa có đơn demo'}</h2><p className="mt-2 text-sm text-coffee-600">{filtered ? 'Thử từ khóa khác hoặc xóa bộ lọc trạng thái để tiếp tục xem.' : 'Bộ dữ liệu đang mô phỏng danh sách rỗng.'}</p><button type="button" onClick={onReset} className="mt-5 min-h-11 rounded-full border border-coffee-300 px-5 text-sm font-bold text-coffee-800 hover:bg-coffee-50">{filtered ? 'Xem tất cả' : 'Tải lại demo'}</button></div>;
}

export function StaffErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center"><h2 className="font-bold text-red-900">Không thể tải danh sách demo</h2><p className="mt-2 text-sm text-red-800">{message}</p><button type="button" onClick={onRetry} className="mt-5 min-h-11 rounded-full bg-coffee-800 px-6 text-sm font-bold text-white hover:bg-coffee-700">Thử lại</button></div>;
}

export function StaffLoadingState({ variant = 'list' }: { variant?: 'list' | 'detail' }) {
  return <div role="status" aria-busy="true" className={`space-y-3 ${variant === 'detail' ? 'min-h-96' : 'min-h-72'}`}>
    <span className="sr-only">{variant === 'detail' ? 'Đang tải chi tiết đơn hàng...' : 'Đang tải danh sách đơn hàng...'}</span>
    {(variant === 'detail' ? [1] : [1, 2]).map((key) => <div key={key} aria-hidden="true" className={`space-y-4 rounded-2xl border border-coffee-100 bg-white p-4 motion-safe:animate-pulse ${variant === 'detail' ? 'min-h-96 sm:p-6' : 'min-h-32'}`}>
      <div className="flex items-center justify-between gap-3"><div className="h-5 w-28 rounded bg-coffee-100" /><div className="h-6 w-20 rounded-full bg-coffee-100" /></div>
      <div className="h-4 w-2/3 rounded bg-coffee-100" />
      {variant === 'detail' && <><div className="h-20 rounded-xl bg-cream-100" /><div className="h-16 rounded-xl bg-cream-100" /></>}
      <div className="flex justify-between gap-3"><div className="h-4 w-24 rounded bg-coffee-100" /><div className="h-4 w-20 rounded bg-coffee-100" /></div>
    </div>)}
  </div>;
}

export function StaffEmptyState({ filtered, onReset, hasOrders = false }: { filtered: boolean; onReset: () => void; hasOrders?: boolean }) {
  return <div role="status" className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-coffee-200 bg-white px-5 py-6 text-center">
    <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cream-100 text-2xl">☕</span>
    <h2 className="mt-3 font-bold text-coffee-950">{filtered ? 'Không có đơn phù hợp' : hasOrders ? 'Trang này chưa có đơn' : 'Chưa có đơn hàng'}</h2>
    <p className="mt-2 max-w-sm text-sm leading-relaxed text-coffee-600">{filtered ? 'Thử từ khóa khác trong trang hiện tại hoặc xóa bộ lọc để xem lại đơn.' : hasOrders ? 'Bạn có thể quay về trang trước hoặc tải lại danh sách.' : 'Quầy đã sẵn sàng. Nhấn tải lại để kiểm tra đơn mới từ khách.'}</p>
    <button type="button" onClick={onReset} className="mt-4 min-h-11 rounded-full border border-coffee-300 px-5 text-sm font-bold text-coffee-800 hover:bg-coffee-50 focus-visible:outline-2 focus-visible:outline-coffee-500">{filtered ? 'Xem tất cả' : 'Tải lại danh sách'}</button>
  </div>;
}

export function StaffErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center"><h2 className="font-bold text-red-900">Không thể tải danh sách đơn</h2><p className="mt-2 text-sm text-red-800">{message}</p><button type="button" onClick={onRetry} className="mt-5 min-h-11 rounded-full bg-coffee-800 px-6 text-sm font-bold text-white hover:bg-coffee-700">Thử lại</button></div>;
}

export function StaffDetailErrorState({ message, notFound, onRetry, onRefresh }: { message: string; notFound: boolean; onRetry: () => void; onRefresh: () => void }) {
  return <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center"><h2 className="font-bold text-red-900">{notFound ? 'Đơn hàng không còn tồn tại' : 'Không thể tải chi tiết đơn'}</h2><p className="mt-2 text-sm text-red-800">{message}</p><button type="button" onClick={notFound ? onRefresh : onRetry} className="mt-5 min-h-11 rounded-full bg-coffee-800 px-6 text-sm font-bold text-white">{notFound ? 'Tải lại danh sách' : 'Thử lại chi tiết'}</button></div>;
}

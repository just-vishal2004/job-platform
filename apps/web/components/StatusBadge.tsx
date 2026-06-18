type Status =
  | 'pending' | 'queued' | 'running'
  | 'completed' | 'failed' | 'cancelled'
  | 'idle' | 'busy' | 'dead';

const styles: Record<Status, string> = {
  pending:   'bg-yellow-900/40 text-yellow-300 border border-yellow-700/50',
  queued:    'bg-blue-900/40 text-blue-300 border border-blue-700/50',
  running:   'bg-indigo-900/40 text-indigo-300 border border-indigo-700/50',
  completed: 'bg-green-900/40 text-green-300 border border-green-700/50',
  failed:    'bg-red-900/40 text-red-300 border border-red-700/50',
  cancelled: 'bg-gray-800/40 text-gray-400 border border-gray-600/50',
  idle:      'bg-green-900/40 text-green-300 border border-green-700/50',
  busy:      'bg-indigo-900/40 text-indigo-300 border border-indigo-700/50',
  dead:      'bg-red-900/40 text-red-300 border border-red-700/50',
};

export default function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[status] ?? styles.cancelled}`}>
      {status}
    </span>
  );
}

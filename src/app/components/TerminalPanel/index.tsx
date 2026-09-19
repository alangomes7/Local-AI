import { useEffect, useRef } from 'react';

export type LogType = 'info' | 'success' | 'warning' | 'error';

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: LogType;
}

export default function TerminalPanel({ logs }: { logs: LogEntry[] }) {
  const endOfLogRef = useRef<HTMLDivElement>(null);

  // Replicates the elements.log.scrollTop = elements.log.scrollHeight behavior
  useEffect(() => {
    endOfLogRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getLogColor = (type: LogType) => {
    switch (type) {
      case 'success': return 'text-green-400'; // log-success
      case 'warning': return 'text-yellow-400'; // log-warning
      case 'error': return 'text-red-400'; // log-error
      default: return 'text-neutral-400'; // log-info
    }
  };

  return (
    <div className="max-h-max overflow-y-auto mt-3 p-2.5 border border-neutral-800 rounded-md bg-[#080c11] font-mono text-[10px] leading-relaxed">
      {logs.map((log) => (
        <div key={log.id} className={`mb-1 ${getLogColor(log.type)}`}>
          <span className="text-neutral-500 mr-2">[{log.timestamp}]</span>
          {log.message}
        </div>
      ))}
      <div ref={endOfLogRef} />
    </div>
  );
}
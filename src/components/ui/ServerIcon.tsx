import { Cpu, Database, Gamepad2, Globe, Server } from 'lucide-react';
import type { ServerCategory } from '../../types/panel';

export function ServerCategoryIcon({ category, className = 'w-4 h-4' }: { category: ServerCategory; className?: string }) {
  switch (category) {
    case 'Game Servers':
      return <Gamepad2 className={className} />;
    case 'Proxies':
      return <Globe className={className} />;
    case 'Databases':
      return <Database className={className} />;
    case 'Applications':
      return <Cpu className={className} />;
    default:
      return <Server className={className} />;
  }
}

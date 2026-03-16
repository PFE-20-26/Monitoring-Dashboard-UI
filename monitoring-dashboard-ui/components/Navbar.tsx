'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
    { name: 'Arrêts & Analytique', href: '/stops' },
    { name: 'Causes d\'Arrêt', href: '/causes' },
    { name: 'Métrage', href: '/metrage' },
    { name: 'Vitesse', href: '/vitesse' },
];

export default function Navbar() {
    const pathname = usePathname();

    return (
        <div className="flex justify-center mb-6">
            <div className="bg-slate-800/50 p-1 rounded-full flex gap-1 transition-all duration-500 backdrop-blur-md border border-slate-700/50 shadow-xl">
                {navItems.map((item) => {
                    const isActive = pathname === item.href || (pathname === '/' && item.href === '/stops');
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ease-out ${isActive
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/40 scale-105'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                                }`}
                        >
                            {item.name}
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}

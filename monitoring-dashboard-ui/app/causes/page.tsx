import CausesClient from '../CausesClient';

export default function Page() {
    return (
        <main className="min-h-screen p-8 flex flex-col items-center">
            <div className="w-full max-w-7xl">
                <CausesClient />
            </div>
        </main>
    );
}

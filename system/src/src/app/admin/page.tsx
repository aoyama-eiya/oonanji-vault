import { redirect } from 'next/navigation';

export default function AdminRoute() {
    redirect('/dashboard?settings=true');
}

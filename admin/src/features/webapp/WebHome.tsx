import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Sparkles, Wallet, Gift } from 'lucide-react';
import { webApi } from '../webauth/web-api';

export function WebHome() {
  const me = useQuery({
    queryKey: ['web', 'me'],
    queryFn: async () => (await webApi.get('/me')).data as { display_name?: string },
  });
  const wallet = useQuery({
    queryKey: ['web', 'wallet'],
    queryFn: async () => (await webApi.get('/wallet')).data as { coin_balance: number },
  });

  const first = me.data?.display_name?.split(' ')[0];

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-br from-indigo-600/40 to-primary-900 p-6 shadow-xl">
        <p className="text-sm text-indigo-200">{first ? `Welcome, ${first}` : 'Welcome'} 👋</p>
        <p className="mt-3 text-sm text-indigo-200/80">Coin balance</p>
        <p className="coin-num mt-1 text-5xl font-extrabold text-gold-300">
          {wallet.data ? wallet.data.coin_balance.toLocaleString('en-IN') : '…'}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <QuickAction to="/earn" icon={Sparkles} label="Earn" />
        <QuickAction to="/wallet" icon={Wallet} label="Wallet" />
        <QuickAction to="/rewards" icon={Gift} label="Rewards" />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-base font-bold text-white">Ready to earn?</h2>
        <p className="mt-1 text-sm leading-relaxed text-indigo-200/80">
          Complete tasks and offers, invite friends, and build your balance — then redeem for
          Amazon, Flipkart and Google Play gift cards.
        </p>
        <Link
          to="/earn"
          className="mt-4 inline-flex rounded-full bg-gold-400 px-5 py-2 text-sm font-extrabold text-primary-950 hover:bg-gold-300"
        >
          Start earning
        </Link>
      </div>
    </div>
  );
}

function QuickAction({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: typeof Sparkles;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] py-4 text-sm font-semibold text-white transition-colors hover:border-gold-400/30 hover:bg-white/[0.05]"
    >
      <span className="inline-flex size-10 items-center justify-center rounded-xl bg-gold-400/10 text-gold-300">
        <Icon className="size-5" />
      </span>
      {label}
    </Link>
  );
}

'use client';

import React, { Suspense, useEffect } from 'react';
import GsiScript from '@/components/GsiScript';
import { StarknetProvider } from '@/components/Starknet/StarknetProviderComponent';
import { AuthProvider } from '@/context/AuthContext';
import { LocaleProvider, useLocale } from '@/context/LocaleContext';
import KeepAliveProvider from '@/app/providers/KeepAliveProvider';
import Header from '@/components/header';
import Footer from '@/components/layout/Footer';

import { WagmiProvider, createConfig, http } from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains';
import { defineChain } from 'viem';
import { Toaster } from "@/components/ui/toaster";

export const storyMainnet = defineChain({
  id: 1514,
  name: 'Story Mainnet',
  network: 'story',
  nativeCurrency: {
    name: 'IP',
    symbol: 'IP',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://mainnet.storyrpc.io'] },
    public: { http: ['https://mainnet.storyrpc.io'] },
  },
});

export const wagmiConfig = createConfig({
  chains: [storyMainnet, mainnet, sepolia],
  transports: {
    [storyMainnet.id]: http('https://mainnet.storyrpc.io'),
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
});

function LangSetter() {
  const { locale } = useLocale();
  useEffect(() => {
    document.documentElement.lang = locale || 'en';
  }, [locale]);
  return null;
}

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const isProd = process.env.NODE_ENV === 'production';

  return (
    <>
      {/* Dev-only: surface silent client errors */}
      {!isProd && (
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                if (window.__dbgHooks) return; window.__dbgHooks = true;
                window.addEventListener('error', e => console.log('[window error]', e.error || e.message));
                window.addEventListener('unhandledrejection', e => console.log('[unhandledrejection]', e.reason));
              })();
            `,
          }}
        />
      )}

      {/* Google Identity Services */}
      <GsiScript />

      {/* All client-side providers live here */}
      <WagmiProvider config={wagmiConfig}>
        <LocaleProvider>
          <LangSetter />
          <StarknetProvider>
            <AuthProvider>
              <KeepAliveProvider requireAuth={false} rtdbPath="_meta/keepalive">
                <div className="site-header">
                  <Suspense fallback={<div style={{ height: 56 }} />}><Header /></Suspense>
                </div>

                <Suspense fallback={<div className="min-h-[40vh] flex items-center justify-center">Loading…</div>}>
                  {children}
                </Suspense>

                <div className="site-footer">
                  <Suspense fallback={null}><Footer /></Suspense>
                </div>
              </KeepAliveProvider>
            </AuthProvider>
          </StarknetProvider>
        </LocaleProvider>
      </WagmiProvider>
          <Toaster />
    </>
  );
}

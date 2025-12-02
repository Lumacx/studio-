// src/app/profile/protect-ip/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/context/LocaleContext';
import { doc, getDoc } from 'firebase/firestore';
import { getClientDb } from '@/lib/firebaseClient';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Wallet, ShieldCheck, Database, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ───────────────────────────────────────────────────────────────────────────────
// Mocks for Widgets (to be replaced with actual integration later)
const WalletWidget = ({ onConnect }: { onConnect: () => void }) => (
  <div className="border border-dashed border-gray-500 rounded-lg p-6 flex flex-col items-center justify-center gap-4 bg-gray-800/50">
    <Wallet className="w-10 h-10 text-gray-400" />
    <p className="text-gray-300 text-sm text-center">
      Connect your Starknet or Metamask wallet to proceed.
    </p>
    <Button onClick={onConnect} className="bg-[#BFA071] text-black hover:bg-[#E0C9A0]">
      Connect Wallet
    </Button>
  </div>
);

const WorldIDWidget = ({ onVerify }: { onVerify: () => void }) => (
  <div className="border border-dashed border-gray-500 rounded-lg p-6 flex flex-col items-center justify-center gap-4 bg-gray-800/50">
    <ShieldCheck className="w-10 h-10 text-gray-400" />
    <p className="text-gray-300 text-sm text-center">
      Verify you are a human using WorldID.
    </p>
    <Button onClick={onVerify} className="bg-[#BFA071] text-black hover:bg-[#E0C9A0]">
      Verify with WorldID
    </Button>
  </div>
);

const StoryProtocolWidget = ({ onSave }: { onSave: () => void }) => (
  <div className="border border-dashed border-gray-500 rounded-lg p-6 flex flex-col items-center justify-center gap-4 bg-gray-800/50">
    <Database className="w-10 h-10 text-gray-400" />
    <p className="text-gray-300 text-sm text-center">
      Save your story metadata and assets to the blockchain via IP Protocol.
    </p>
    <Button onClick={onSave} className="bg-[#BFA071] text-black hover:bg-[#E0C9A0]">
      Save IP on Blockchain
    </Button>
  </div>
);

export default function ProtectIPPage() {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const storyId = searchParams.get('storyId');
  const { user, starknetAddress } = useAuth();
  const { toast } = useToast();
  const db = getClientDb();

  const [story, setStory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Step state: 0=Connect Wallet, 1=Humanity Proof, 2=Save IP
  const [currentStep, setCurrentStep] = useState(0);
  const [walletConnected, setWalletConnected] = useState(false);
  const [humanityVerified, setHumanityVerified] = useState(false);
  const [ipSaved, setIpSaved] = useState(false);

  useEffect(() => {
    if (!storyId) {
      router.push('/profile');
      return;
    }

    const fetchStory = async () => {
      try {
        const docRef = doc(db, 'stories', storyId);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          setStory({ id: snapshot.id, ...snapshot.data() });
        } else {
          toast({
            title: "Story not found",
            description: "Could not find the story you are looking for.",
            variant: "destructive"
          });
          router.push('/profile');
        }
      } catch (error) {
        console.error("Error fetching story:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStory();
  }, [storyId, db, router, toast]);

  // Auto-detect wallet connection (mock logic or real if available in context)
  useEffect(() => {
    if (starknetAddress) {
      setWalletConnected(true);
      if (currentStep === 0) setCurrentStep(1);
    }
  }, [starknetAddress, currentStep]);

  const handleConnectWallet = () => {
    // In a real scenario, this would trigger the wallet connection modal from AuthContext or StarknetProvider
    // For now, we simulate a successful connection
    setWalletConnected(true);
    setCurrentStep(1);
    toast({ title: "Wallet Connected", description: "Your wallet has been successfully connected." });
  };

  const handleHumanityProof = () => {
    // Simulate WorldID verification
    setTimeout(() => {
      setHumanityVerified(true);
      setCurrentStep(2);
      toast({ title: "Humanity Verified", description: "You have been verified as a human." });
    }, 1500);
  };

  const handleSaveIP = () => {
    // Simulate saving to IP Protocol
    setTimeout(() => {
      setIpSaved(true);
      toast({ title: "IP Saved", description: "Your IP has been successfully saved to the blockchain." });
    }, 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b1220] text-[#E0C9A0]">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1220] text-[#E0C9A0] font-['Georgia'] p-6 flex flex-col items-center">
      <div className="w-full max-w-4xl">
        <div className="mb-8">
           <Button 
            variant="ghost" 
            className="text-[#E0C9A0] hover:text-[#BFA071] pl-0"
            onClick={() => router.back()}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Profile
          </Button>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-center mb-2 text-[#BFA071]">
          Protecting your IP on the Blockchain
        </h1>
        <p className="text-center text-gray-400 mb-10">
          Secure ownership of "{story?.title || 'Untitled Story'}"
        </p>

        {/* Stepper / Pills */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-12 px-4 md:px-20">
          {/* Step 1 */}
          <div className={`flex items-center gap-2 px-6 py-3 rounded-full border ${currentStep >= 0 ? 'bg-[#BFA071] text-[#1A2533] border-[#BFA071]' : 'bg-transparent border-gray-600 text-gray-500'}`}>
            <Wallet className="w-5 h-5" />
            <span className="font-bold">1. Connect Wallet</span>
          </div>
          
          <div className={`hidden md:block h-0.5 w-16 ${currentStep >= 1 ? 'bg-[#BFA071]' : 'bg-gray-700'}`}></div>

          {/* Step 2 */}
          <div className={`flex items-center gap-2 px-6 py-3 rounded-full border ${currentStep >= 1 ? 'bg-[#BFA071] text-[#1A2533] border-[#BFA071]' : 'bg-transparent border-gray-600 text-gray-500'}`}>
            <ShieldCheck className="w-5 h-5" />
            <span className="font-bold">2. Humanity Proof</span>
          </div>

          <div className={`hidden md:block h-0.5 w-16 ${currentStep >= 2 ? 'bg-[#BFA071]' : 'bg-gray-700'}`}></div>

          {/* Step 3 */}
          <div className={`flex items-center gap-2 px-6 py-3 rounded-full border ${currentStep >= 2 ? 'bg-[#BFA071] text-[#1A2533] border-[#BFA071]' : 'bg-transparent border-gray-600 text-gray-500'}`}>
            <Database className="w-5 h-5" />
            <span className="font-bold">3. Save IP</span>
          </div>
        </div>

        {/* Content Area */}
        <div className="bg-[#162235] border border-[#4A5C6E] rounded-xl p-8 shadow-xl min-h-[400px] flex flex-col justify-center">
          
          {currentStep === 0 && (
             <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
               <h2 className="text-2xl font-bold mb-4 text-center">Connect Your Wallet</h2>
               <p className="text-gray-400 mb-8 text-center max-w-lg mx-auto">
                 To register your intellectual property on the blockchain, you need a wallet. 
                 We support Starknet and Ethereum wallets.
               </p>
               <div className="max-w-md mx-auto">
                 <WalletWidget onConnect={handleConnectWallet} />
               </div>
             </div>
          )}

          {currentStep === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-bold mb-4 text-center">Verify Humanity</h2>
              <p className="text-gray-400 mb-8 text-center max-w-lg mx-auto">
                Ensure that this creative work belongs to a real human. 
                We use WorldID to verify your unique personhood without revealing your identity.
              </p>
              <div className="max-w-md mx-auto">
                <WorldIDWidget onVerify={handleHumanityProof} />
              </div>
            </div>
          )}

          {currentStep === 2 && !ipSaved && (
             <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
               <h2 className="text-2xl font-bold mb-4 text-center">Save to Blockchain</h2>
               <p className="text-gray-400 mb-8 text-center max-w-lg mx-auto">
                 Ready to mint your IP. This will save the story metadata, cover image, 
                 and generated assets to the IP Protocol network.
               </p>
               <div className="max-w-md mx-auto">
                 <StoryProtocolWidget onSave={handleSaveIP} />
               </div>
             </div>
          )}

          {currentStep === 2 && ipSaved && (
            <div className="text-center animate-in zoom-in duration-500">
              <div className="w-20 h-20 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-6">
                <Database className="w-10 h-10" />
              </div>
              <h2 className="text-3xl font-bold text-[#BFA071] mb-4">IP Successfully Registered!</h2>
              <p className="text-gray-300 mb-8 max-w-lg mx-auto">
                Your story "{story.title}" is now protected on the blockchain. 
                You can view the transaction details in your wallet.
              </p>
              <Button onClick={() => router.push('/profile')} className="bg-[#BFA071] text-black hover:bg-[#E0C9A0] font-bold px-8 py-3 rounded-full">
                Return to Profile
              </Button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

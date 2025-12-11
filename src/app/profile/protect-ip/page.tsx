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

import { IDKitWidget, VerificationLevel } from '@worldcoin/idkit';

import { useConnect as useStarknetConnect } from '@starknet-react/core';

import { useAccount as useEvmAccount, useConnect as useEvmConnect, type Connector } from 'wagmi';

import { StoryClient } from "@story-protocol/core-sdk";

import { http } from "viem";

import { sepolia } from 'viem/chains';



// ───────────────────────────────────────────────────────────────────────────────

// Widgets

const WalletWidget = ({ onConnect }: { onConnect: () => void }) => (

  <div className="border border-dashed border-gray-500 rounded-lg p-6 flex flex-col items-center justify-center gap-4 bg-gray-800/50">

    <Wallet className="w-10 h-10 text-gray-400" />

    <p className="text-gray-300 text-sm text-center">

      Connect your Starknet wallet to proceed.

    </p>

    <Button onClick={onConnect} className="bg-[#BFA071] text-black hover:bg-[#E0C9A0]">

      Connect Starknet Wallet

    </Button>

  </div>

);



const StoryProtocolWidget = ({ onSave, onConnect, isConnected }: { onSave: () => void; onConnect: () => void; isConnected: boolean; }) => (

  <div className="border border-dashed border-gray-500 rounded-lg p-6 flex flex-col items-center justify-center gap-4 bg-gray-800/50">

    <Database className="w-10 h-10 text-gray-400" />

    <p className="text-gray-300 text-sm text-center">

      Save your story metadata and assets to the blockchain via IP Protocol.

    </p>

    {isConnected ? (

      <Button onClick={onSave} className="bg-[#BFA071] text-black hover:bg-[#E0C9A0]">

        Save IP on Blockchain

      </Button>

    ) : (

      <Button onClick={onConnect} className="bg-[#BFA071] text-black hover:bg-[#E0C9A0]">

        Connect EVM Wallet

      </Button>

    )}

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

 

  // Starknet

  const { connect: starknetConnect, connectors: starknetConnectors } = useStarknetConnect();

 

  // EVM

  const { address: evmAddress, isConnected: isEvmConnected, chain } = useEvmAccount();

  const { connect: evmConnect, connectors: evmConnectors } = useEvmConnect();



  const [story, setStory] = useState<any>(null);

  const [loading, setLoading] = useState(true);

 

  const [currentStep, setCurrentStep] = useState(0);

  const [ipSaved, setIpSaved] = useState(false);

  const [showStarknetDialog, setShowStarknetDialog] = useState(false);

  const [showEvmDialog, setShowEvmDialog] = useState(false);

 

  const verifyProof = async (proof: any) => {

    const response = await fetch('/api/worldcoin/verify', {

      method: 'POST',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify(proof),

    });

    if (response.ok) {

        const { verified } = await response.json();

        return verified;

    } else {

        const { code, detail } = await response.json();

        throw new Error(`Error Code ${code}: ${detail}`);

    }

  };



  const onVerificationSuccess = () => {

    setCurrentStep(2);

    toast({ title: "Humanity Verified", description: "You have been verified as a human." });

  };



  useEffect(() => {

    if (!storyId) { router.push('/profile'); return; }

    const fetchStory = async () => {

      try {

        const snapshot = await getDoc(doc(db, 'stories', storyId));

        if (snapshot.exists()) {

          setStory({ id: snapshot.id, ...snapshot.data() });

        } else {

          toast({ title: "Story not found", variant: "destructive" });

          router.push('/profile');

        }

      } catch (error) { console.error("Error fetching story:", error);

      } finally { setLoading(false); }

    };

    fetchStory();

  }, [storyId, db, router, toast]);



  useEffect(() => {

    if (starknetAddress && currentStep === 0) {

      setCurrentStep(1);

      toast({ title: "Starknet Wallet Connected" });

    }

  }, [starknetAddress, currentStep, toast]);



  const handleSaveIP = async () => {

    if (!isEvmConnected || !evmAddress) {

      toast({ title: "Please connect an EVM wallet first.", variant: "destructive" });

      return;

    }

    if (chain?.id !== sepolia.id) {

        toast({ title: "Please switch to Sepolia network.", variant: "destructive" });

        return;

    }



    toast({ title: "Saving IP to blockchain...", description: "This may take a moment." });



    try {

      // 1. Create a Story Client.

      // The client needs a transport to read from the blockchain, and an account to sign transactions.

      const storyClient = StoryClient.newClient({
        account: evmAddress,
        transport: http('https://rpc.sepolia.org'),
        chainId: 'sepolia', // or 'sepolia' as const

      });



      // 2. Use a placeholder NFT.

      // In a real scenario, you would first mint an NFT for the story.

      // This step is mocked for now.

      const placeholderNft = {

        tokenContract: "0x5a33aA38f2Ce351584A596515869446973416c14", // Example contract address on Sepolia

        tokenId: 1n, // Example token ID

      };

      toast({ title: "Using Placeholder NFT", description: `Contract: ${placeholderNft.tokenContract}` });


      // 3. Register the IP Asset

      const registerIpAsset = await storyClient.ipAsset.register({
        nftContract: placeholderNft.tokenContract, // CHANGED from tokenContract
        tokenId: placeholderNft.tokenId,
        metadata: {
            metadataURI: "https://moccasin-changing-squid-607.mypinata.cloud/ipfs/bafybeibebidhossx47qm3j6y6k2zove6qs3m2oylpa2ujvu7jbzfbedelq",
            metadataHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
            nftMetadataHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
        },
        txOptions: { waitForTransaction: true }

      });



      setIpSaved(true);

      toast({ title: "IP Saved Successfully!", description: `Transaction: ${registerIpAsset.txHash}` });

    } catch (error) {

      console.error("Error saving IP:", error);

      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";

      toast({ title: "Error Saving IP", description: errorMessage, variant: "destructive" });

    }

  };



  if (loading) {

    return <div className="min-h-screen flex items-center justify-center bg-[#0b1220] text-[#E0C9A0]">Loading...</div>;

  }



  return (

    <div className="min-h-screen bg-[#0b1220] text-[#E0C9A0] font-['Georgia'] p-6 flex flex-col items-center">

      <div className="w-full max-w-4xl">

        <div className="mb-8">

           <Button variant="ghost" className="text-[#E0C9A0] hover:text-[#BFA071] pl-0" onClick={() => router.back()}>

            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Profile

          </Button>

        </div>



        <h1 className="text-3xl md:text-4xl font-bold text-center mb-2 text-[#BFA071]">Protecting your IP on the Blockchain</h1>

        <p className="text-center text-gray-400 mb-10">Secure ownership of "{story?.title || 'Untitled Story'}"</p>



        {/* Stepper */}

        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-12 px-4 md:px-20">

          <div className={`flex items-center gap-2 px-6 py-3 rounded-full border ${currentStep >= 0 ? 'bg-[#BFA071] text-[#1A2533] border-[#BFA071]' : 'bg-transparent border-gray-600 text-gray-500'}`}>

            <Wallet className="w-5 h-5" /> <span className="font-bold">1. Connect Wallet</span>

          </div>

          <div className={`hidden md:block h-0.5 w-16 ${currentStep >= 1 ? 'bg-[#BFA071]' : 'bg-gray-700'}`}></div>

          <div className={`flex items-center gap-2 px-6 py-3 rounded-full border ${currentStep >= 1 ? 'bg-[#BFA071] text-[#1A2533] border-[#BFA071]' : 'bg-transparent border-gray-600 text-gray-500'}`}>

            <ShieldCheck className="w-5 h-5" /> <span className="font-bold">2. Humanity Proof</span>

          </div>

          <div className={`hidden md:block h-0.5 w-16 ${currentStep >= 2 ? 'bg-[#BFA071]' : 'bg-gray-700'}`}></div>

          <div className={`flex items-center gap-2 px-6 py-3 rounded-full border ${currentStep >= 2 ? 'bg-[#BFA071] text-[#1A2533] border-[#BFA071]' : 'bg-transparent border-gray-600 text-gray-500'}`}>

            <Database className="w-5 h-5" /> <span className="font-bold">3. Save IP</span>

          </div>

        </div>



        {/* Content Area */}

        <div className="bg-[#162235] border border-[#4A5C6E] rounded-xl p-8 shadow-xl min-h-[400px] flex flex-col justify-center">

         

          {currentStep === 0 && (

             <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

               <h2 className="text-2xl font-bold mb-4 text-center">Connect Your Starknet Wallet</h2>

               <p className="text-gray-400 mb-8 text-center max-w-lg mx-auto">A Starknet wallet is required for certain features on our platform.</p>

               <div className="max-w-md mx-auto">

                 <WalletWidget onConnect={() => setShowStarknetDialog(true)} />

               </div>

             </div>

          )}



          {currentStep === 1 && (

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

              <h2 className="text-2xl font-bold mb-4 text-center">Verify Humanity</h2>

              <p className="text-gray-400 mb-8 text-center max-w-lg mx-auto">We use WorldID to verify your unique personhood without revealing your identity.</p>

              <div className="max-w-md mx-auto">

                <IDKitWidget

                    app_id="app_f94ef81d75376893542354da9f3e83d6"

                    action="humanity-proof"

                    verification_level={VerificationLevel.Device}

                    handleVerify={verifyProof}

                    onSuccess={onVerificationSuccess}>

                    {({ open }) => (

                      <div className="border border-dashed border-gray-500 rounded-lg p-6 flex flex-col items-center justify-center gap-4 bg-gray-800/50">

                        <ShieldCheck className="w-10 h-10 text-gray-400" />

                        <p className="text-gray-300 text-sm text-center">Verify you are a human using WorldID.</p>

                        <Button onClick={open} className="bg-[#BFA071] text-black hover:bg-[#E0C9A0]">Verify with WorldID</Button>

                      </div>

                    )}

                </IDKitWidget>

              </div>

            </div>

          )}



          {currentStep === 2 && !ipSaved && (

             <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

               <h2 className="text-2xl font-bold mb-4 text-center">Save to Blockchain</h2>

               <p className="text-gray-400 mb-8 text-center max-w-lg mx-auto">Ready to mint your IP. This will save the story metadata to the Story Protocol network.</p>

               <div className="max-w-md mx-auto">

                 <StoryProtocolWidget onSave={handleSaveIP} onConnect={() => setShowEvmDialog(true)} isConnected={isEvmConnected} />

               </div>

             </div>

          )}



          {currentStep === 2 && ipSaved && (

            <div className="text-center animate-in zoom-in duration-500">

              <div className="w-20 h-20 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-6">

                <Database className="w-10 h-10" />

              </div>

              <h2 className="text-3xl font-bold text-[#BFA071] mb-4">IP Successfully Registered!</h2>

              <p className="text-gray-300 mb-8 max-w-lg mx-auto">Your story "{story.title}" is now protected on the blockchain.</p>

              <Button onClick={() => router.push('/profile')} className="bg-[#BFA071] text-black hover:bg-[#E0C9A0] font-bold px-8 py-3 rounded-full">

                Return to Profile

              </Button>

            </div>

          )}



        </div>

      </div>

      {/* Starknet Wallet Dialog */}

       <Dialog open={showStarknetDialog} onOpenChange={setShowStarknetDialog}>

        <DialogContent className="bg-[#162235] border-[#4A5C6E] text-[#E0C9A0]">

          <DialogHeader>

            <DialogTitle>Connect a Starknet Wallet</DialogTitle>

            <DialogDescription>Please select a wallet to continue.</DialogDescription>

          </DialogHeader>

          <div className="flex flex-col gap-4 pt-4">

            {starknetConnectors.map((connector) => (

              <Button key={connector.id} onClick={() => { starknetConnect({ connector }); setShowStarknetDialog(false); }} className="bg-[#BFA071] text-black hover:bg-[#E0C9A0] justify-start">

                {connector.name}

              </Button>

            ))}

          </div>

        </DialogContent>

      </Dialog>

      {/* EVM Wallet Dialog */}

       <Dialog open={showEvmDialog} onOpenChange={setShowEvmDialog}>

        <DialogContent className="bg-[#162235] border-[#4A5C6E] text-[#E0C9A0]">

          <DialogHeader>

            <DialogTitle>Connect an EVM Wallet</DialogTitle>

            <DialogDescription>A wallet like Metamask is required for this step.</DialogDescription>

          </DialogHeader>

          <div className="flex flex-col gap-4 pt-4">

            {evmConnectors.map((connector: Connector) => (

              <Button key={connector.id} onClick={() => { evmConnect({ connector }); setShowEvmDialog(false); }} className="bg-[#BFA071] text-black hover:bg-[#E0C9A0] justify-start">

                {connector.name}

              </Button>

            ))}

          </div>

        </DialogContent>

      </Dialog>

    </div>

  );

}
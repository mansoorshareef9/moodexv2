import useSWR from "swr";
import Image from "next/image";
import {
  POLYGON_TOKENS_BY_SYMBOL,
  POLYGON_TOKENS_BY_ADDRESS,
} from "../../lib/constants";
import { fetcher } from "../Price";
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import type { PriceResponse, QuoteResponse } from "../api/types";
import { formatUnits } from "ethers";
import {
  useAccount,
  useSendTransaction,
  usePrepareSendTransaction,
  useWaitForTransaction,
  type Address,
} from "wagmi";
import styles from '../Price/Form.module.css';
import React from 'react';


const AFFILIATE_FEE = 0.0; // Percentage of the buyAmount that should be attributed to feeRecipient as affiliate fees
const FEE_RECIPIENT = "0xD86766b68e844E9096662d0E38Bc6d11e803B7Bb"; // The ETH address that should receive affiliate fees

export default function QuoteView({
  price,
  quote,
  setQuote,
  takerAddress,
}: {
  price: PriceResponse;
  quote: QuoteResponse | undefined;
  setQuote: (price: any) => void;
  takerAddress: Address | undefined;
}) {
  const sellTokenInfo = POLYGON_TOKENS_BY_ADDRESS[price.sellTokenAddress.toLowerCase()];
  const buyTokenInfo = POLYGON_TOKENS_BY_ADDRESS[price.buyTokenAddress.toLowerCase()];

  // fetch quote here
  const { address } = useAccount();
  const router = useRouter();

  const { isLoading: isLoadingPrice } = useSWR(
    [
      "/api/quote",
      {
        sellToken: price.sellTokenAddress,
        buyToken: price.buyTokenAddress,
        sellAmount: price.sellAmount,
        takerAddress,
        feeRecipient: FEE_RECIPIENT,
        buyTokenPercentageFee: AFFILIATE_FEE,
      },
    ],
    fetcher,
    {
      onSuccess: (data) => {
        setQuote(data);
        console.log("quote", data);
        console.log(formatUnits(data.buyAmount, buyTokenInfo.decimals), data);
      },
    },
  );

  const { config } = usePrepareSendTransaction({
    to: quote?.to, // The address of the contract to send call data to, in this case 0x Exchange Proxy
    data: quote?.data, // The call data required to be sent to the to contract address.
  });

  const { sendTransaction, data: transactionData } = useSendTransaction(config);
  const [transactionStatus, setTransactionStatus] = useState<'idle' | 'pending' | 'success' | 'error' | 'rejected'>('idle');
  const [popupVisible, setPopupVisible] = useState(false);

  const handlePlaceOrder = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (!sendTransaction) return;

    setTransactionStatus('pending');
    setPopupVisible(true);

    try {
      await sendTransaction();
      console.log('Transaction sent');
    } catch (error: any) {
      if (error.code === 4001) {
        // User rejected the transaction
        setTransactionStatus('rejected');
      } else {
        console.error("Transaction error:", error);
        setTransactionStatus('error');
      }
    }
  };

  const { data: receipt, isSuccess, isError } = useWaitForTransaction({
    hash: transactionData?.hash,
  });

  useEffect(() => {
    if (isSuccess) {
      setTransactionStatus('success');
    } else if (isError) {
      setTransactionStatus('error');
    }
  }, [isSuccess, isError]);

  const handleClose = () => {
    setPopupVisible(false);
    router.push('/'); // Redirect to the beginning page
  };

  if (!quote) {
    return <div>Getting best quote...</div>;
  }

  return (
    <div className="p-3 mx-auto max-w-screen-sm ">
      <button
        className="bg-dark-200 text-white text-xl font-bold py-2 px-4 rounded mt-4"
        onClick={() => {
          router.reload();
        }}
      >
        Go Back
      </button>
      <form className={styles.form}>
        <div>
          <div className="text-xl mb-2 text-white">You pay</div>
          <div className="flex items-center text-lg sm:text-3xl mb-4 text-white">
            <img
              alt={sellTokenInfo.symbol}
              className="h-9 w-9 mr-2 rounded-md"
              src={sellTokenInfo.logoURI}
            />
            <span>{quote.sellAmount && sellTokenInfo.decimals !== undefined ? formatUnits(quote.sellAmount, sellTokenInfo.decimals) : 'Invalid Amount'}</span>
            <div className="ml-2">{sellTokenInfo.symbol}</div>
          </div>
        </div>

        <div>
          <div className="text-xl mb-2 text-white">You receive</div>
          <div className="flex items-center text-lg sm:text-3xl mb-4 text-white">
            <img
              alt={
                POLYGON_TOKENS_BY_ADDRESS[price.buyTokenAddress.toLowerCase()]
                  .symbol
              }
              className="h-9 w-9 mr-2 rounded-md"
              src={
                POLYGON_TOKENS_BY_ADDRESS[price.buyTokenAddress.toLowerCase()]
                  .logoURI
              }
            />
            <span>{quote.buyAmount && buyTokenInfo.decimals !== undefined ? Number(formatUnits(quote.buyAmount, buyTokenInfo.decimals)).toFixed(2) : 'Invalid Amount'}</span>
            <div className="ml-2">{buyTokenInfo.symbol}</div>
          </div>
        </div>
        <div>
          <div className="text-white mb-4 ">
            {quote && quote.grossBuyAmount
              ? "Affiliate Fee: " +
                (quote.grossBuyAmount && buyTokenInfo.decimals !== undefined ? 
                  Number(formatUnits(BigInt(quote.grossBuyAmount), buyTokenInfo.decimals)) *
                  AFFILIATE_FEE : 'Invalid Amount') +
                " " +
                buyTokenInfo.symbol
              : null}
          </div>
        </div>
        <button
          className={styles.button}
          onClick={handlePlaceOrder}
        >
          Place Order
        </button>
      </form>

      {popupVisible && (
        <div className="popup">
          {transactionStatus === 'pending' && <p>Transaction is pending...</p>}
          {transactionStatus === 'success' && <p>Transaction was successful!</p>}
          {transactionStatus === 'error' && <p>Transaction failed. Please try again.</p>}
          {transactionStatus === 'rejected' && <p>Transaction was rejected by the user.</p>}
          <button onClick={handleClose}>Close</button>
        </div>
      )}

      <style jsx>{`
        .popup {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: white;
          padding: 20px;
          border: 1px solid black;
          z-index: 1000;
        }
      `}</style>
    </div>
  );
}

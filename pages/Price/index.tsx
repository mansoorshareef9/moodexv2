import qs from "qs";
import React from 'react';

import useSWR from "swr";
import { ConnectKitButton } from "connectkit";
import { useState, ChangeEvent } from "react";
import { ethers } from "ethers";
import styles from './Form.module.css';
import { formatUnits, parseUnits } from "ethers";
import {
  erc20ABI,
  useContractRead,
  usePrepareContractWrite,
  useContractWrite,
  useWaitForTransaction,
  useBalance,
  type Address,
} from "wagmi";
import {
  POLYGON_TOKENS,
  POLYGON_TOKENS_BY_SYMBOL,
  POLYGON_TOKENS_BY_ADDRESS,
  MAX_ALLOWANCE,
  exchangeProxy,
} from "../../lib/constants";

interface PriceRequestParams {
  sellToken: string;
  buyToken: string;
  buyAmount?: string;
  sellAmount?: string;
  takerAddress?: string;
}

const AFFILIATE_FEE = 0.0; // Percentage of the buyAmount that should be attributed to feeRecipient as affiliate fees
const FEE_RECIPIENT = "0xD86766b68e844E9096662d0E38Bc6d11e803B7Bb"; // The ETH address that should receive affiliate fees

export const fetcher = ([endpoint, params]: [string, PriceRequestParams]) => {
  const { sellAmount, buyAmount } = params;
  if (!sellAmount && !buyAmount) return;
  const query = qs.stringify(params);

  return fetch(`${endpoint}?${query}`).then((res) => res.json());
};

export default function PriceView({
  price,
  setPrice,
  setFinalize,
  takerAddress,
}: {
  price: any;
  setPrice: (price: any) => void;
  setFinalize: (finalize: boolean) => void;
  takerAddress: Address | undefined;
}) {
  const [sellAmount, setSellAmount] = useState("");
  const [buyAmount, setBuyAmount] = useState("");
  const [tradeDirection, setTradeDirection] = useState("sell");
  const [sellToken, setSellToken] = useState("wmatic");
  const [buyToken, setBuyToken] = useState("holycow");

  const handleSellTokenChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setSellToken(e.target.value);
  };

  function handleBuyTokenChange(e: ChangeEvent<HTMLSelectElement>) {
    setBuyToken(e.target.value);
  }

  const toggleTokens = () => {
    // Swap tokens and amounts
    setSellToken(prevSellToken => {
      const newBuyToken = buyToken;
      setBuyToken(prevSellToken);
      return newBuyToken;
    });
    setSellAmount(prevSellAmount => {
      const newBuyAmount = buyAmount;
      setBuyAmount(prevSellAmount);
      return newBuyAmount;
    });
  };

  const sellTokenDecimals = POLYGON_TOKENS_BY_SYMBOL[sellToken].decimals;

  const parsedSellAmount =
    sellAmount && tradeDirection === "sell"
      ? parseUnits(sellAmount, sellTokenDecimals).toString()
      : undefined;

  const buyTokenDecimals = POLYGON_TOKENS_BY_SYMBOL[buyToken].decimals;

  const parsedBuyAmount =
    buyAmount && tradeDirection === "buy"
      ? parseUnits(buyAmount, buyTokenDecimals).toString()
      : undefined;

  // fetch price here
  const { isLoading: isLoadingPrice } = useSWR(
    [
      "/api/price",
      {
        sellToken: POLYGON_TOKENS_BY_SYMBOL[sellToken].address,
        buyToken: POLYGON_TOKENS_BY_SYMBOL[buyToken].address,
        sellAmount: parsedSellAmount,
        buyAmount: parsedBuyAmount,
        takerAddress,
        feeRecipient: FEE_RECIPIENT,
        buyTokenPercentageFee: AFFILIATE_FEE,
      },
    ],
    fetcher,
    {
      onSuccess: (data) => {
        setPrice(data);
        if (tradeDirection === "sell") {
          setBuyAmount(formatUnits(data.buyAmount, buyTokenDecimals));
        } else {
          setSellAmount(formatUnits(data.sellAmount, sellTokenDecimals));
        }
      },
    },
  );

  const { data, isError, isLoading } = useBalance({
    address: takerAddress,
    token: POLYGON_TOKENS_BY_SYMBOL[sellToken].address,
  });

  const disabled =
    data && sellAmount
      ? parseUnits(sellAmount, sellTokenDecimals) > data.value
      : true;

  return (
    <form className={styles.form}>
      <h1 className={styles.heading}>MooDeX</h1>

      <p className={styles.subheading}>powered by $holycow</p>

      <div className="p-4 rounded-md mb-4">
        <section className={styles.tokenSection}>
          <label htmlFor="sell-select" className="sr-only"></label>
          <img
            alt={sellToken}
            className={styles.tokenImage}
            src={POLYGON_TOKENS_BY_SYMBOL[sellToken].logoURI}
          />
          <div className="sm:w-full sm:mr-2">
            <select
              value={sellToken}
              name="sell-token-select"
              id="sell-token-select"
              className={styles.select}
              onChange={handleSellTokenChange}
            >
              {POLYGON_TOKENS.map((token) => (
                <option key={token.address} value={token.symbol.toLowerCase()}>
                  {token.symbol}
                </option>
              ))}
            </select>
          </div>
          <label htmlFor="sell-amount" className="sr-only"></label>
          <input
            id="sell-amount"
            value={sellAmount}
            className={styles.input}
            style={{ border: '1px solid black' }}
            onChange={(e) => {
              setTradeDirection('sell');
              setSellAmount(e.target.value);
            }}
          />
        </section>

        <button
        type="button"
        className={styles.toggleButton}
        onClick={toggleTokens}
      >
 <img 
    src="/inv.jpg"  // Path relative to the `public` directory
    alt="Toggle Icon" 
    className={styles.toggleIcon} 
  />
      </button>

        <section className={styles.tokenSection}>
          <label htmlFor="buy-token" className="sr-only"></label>
          <img
            alt={buyToken}
            className={styles.tokenImage}
            src={POLYGON_TOKENS_BY_SYMBOL[buyToken].logoURI}
          />
          <div className="sm:w-full sm:mr-2">
            <select
              name="buy-token-select"
              id="buy-token-select"
              value={buyToken}
              className={styles.select}
              onChange={(e) => handleBuyTokenChange(e)}
            >
              {POLYGON_TOKENS.map((token) => (
                <option key={token.address} value={token.symbol.toLowerCase()}>
                  {token.symbol}
                </option>
              ))}
            </select>
          </div>
          <label htmlFor="buy-amount" className="sr-only"></label>
          <input
            id="buy-amount"
            value={buyAmount}
            className={`${styles.input} ${styles.inputDisabled}`}
            style={{ border: '1px solid black' }}
            disabled
            onChange={(e) => {
              setTradeDirection('buy');
              setBuyAmount(e.target.value);
            }}
          />
        </section>

        <div className={styles.affiliateFee}>
          {price && price.grossBuyAmount
            ? `Affiliate Fee: ${Number(
                formatUnits(
                  BigInt(price.grossBuyAmount),
                  POLYGON_TOKENS_BY_SYMBOL[buyToken].decimals,
                ),
              ) * AFFILIATE_FEE} ${POLYGON_TOKENS_BY_SYMBOL[buyToken].symbol}`
            : null}
        </div>
      </div>

      {takerAddress ? (
        <ApproveOrReviewButton
          sellTokenAddress={POLYGON_TOKENS_BY_SYMBOL[sellToken].address}
          takerAddress={takerAddress}
          onClick={() => {
            setFinalize(true);
          }}
          disabled={disabled}
        />
      ) : (
        <ConnectKitButton.Custom>
          {({ isConnected, show, address }) => (
            <button
              onClick={show}
              type="button"
              className={styles.button}
            >
              {isConnected ? address : 'Connect Wallet'}
            </button>
          )}
        </ConnectKitButton.Custom>
      )}

      {isLoadingPrice && (
        <div className={styles.loading}>Fetching the best price...</div>
      )}
    </form>
  );
}

function ApproveOrReviewButton({
  takerAddress,
  onClick,
  sellTokenAddress,
  disabled,
}: {
  takerAddress: Address;
  onClick: () => void;
  sellTokenAddress: Address;
  disabled?: boolean;
}) {
  // 1. Read from erc20, does spender (0x Exchange Proxy) have allowance?
  const { data: allowance, refetch } = useContractRead({
    address: sellTokenAddress,
    abi: erc20ABI,
    functionName: "allowance",
    args: [takerAddress, exchangeProxy],
  });

  // 2. (only if no allowance): write to erc20, approve 0x Exchange Proxy to spend max integer
  const { config } = usePrepareContractWrite({
    address: sellTokenAddress,
    abi: erc20ABI,
    functionName: "approve",
    args: [exchangeProxy, MAX_ALLOWANCE],
  });

  const {
    data: writeContractResult,
    writeAsync: approveAsync,
    error,
  } = useContractWrite(config);

  const { isLoading: isApproving } = useWaitForTransaction({
    hash: writeContractResult ? writeContractResult.hash : undefined,
    onSuccess(data) {
      refetch();
    },
  });

  if (error) {
    return <div>Something went wrong: {error.message}</div>;
  }

  if (allowance === 0n && approveAsync) {
    return (
      <>
        <button
          type="button"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full"
          onClick={async () => {
            const writtenValue = await approveAsync();
          }}
        >
          {isApproving ? "Approving…" : "Approve"}
        </button>
      </>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={styles.button}
    >
      {disabled ? "Insufficient Balance" : "Review Trade"}
    </button>
  );
}

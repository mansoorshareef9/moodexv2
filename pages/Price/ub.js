import { useBalance } from 'wagmi';

const sellTokenAddress = sellToken === "MATIC" 
  ? undefined 
  : POLYGON_TOKENS_BY_SYMBOL[sellToken]?.address;

const buyTokenAddress = buyToken === "MATIC" 
  ? undefined 
  : POLYGON_TOKENS_BY_SYMBOL[buyToken]?.address;

const { data: sellTokenBalance, isError: sellError, isLoading: sellLoading } = useBalance({
  address: takerAddress,
  token: sellTokenAddress,
});

const { data: buyTokenBalance, isError: buyError, isLoading: buyLoading } = useBalance({
  address: takerAddress,
  token: buyTokenAddress,
});

// Optional: Add some console logs or error handling to diagnose the issue
if (sellError || buyError) {
  console.error('Error fetching balance:', sellError || buyError);
}

console.log('Sell Token Balance:', sellTokenBalance);
console.log('Buy Token Balance:', buyTokenBalance);

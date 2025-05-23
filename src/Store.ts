import { CacheCategory } from "./Constants";
import type { poolRewardAddressMapping } from "./CustomTypes";
import {
  Cache,
  type Entry,
  type ShapeBribeToPool,
  type ShapeGuageToPool,
} from "./cache";

export const poolLookupStoreManager = () => {
  /*
  NOTE: here the cache is to make sure this code is restart resistant, it is not for performance optimization (actually the cache will have a negative impact on performance)
  */
  type lookups = {
    gaugeToPoolCache: Entry<ShapeGuageToPool>;
    bribeVotingToPoolCache: Entry<ShapeBribeToPool>;
  };
  const cacheMap = new Map<string | number | bigint, lookups>();

  const getCache = async (
    chainId: string | number | bigint,
  ): Promise<lookups> => {
    const cache = cacheMap.get(chainId);
    if (!cache) {
      const newCache = {
        gaugeToPoolCache: await Cache.init(CacheCategory.GuageToPool, chainId),
        bribeVotingToPoolCache: await Cache.init(
          CacheCategory.BribeToPool,
          chainId,
        ),
      };
      cacheMap.set(chainId, newCache);
      return newCache;
    }
    return cache;
  };

  const addRewardAddressDetails = async (
    chainId: string | number | bigint,
    details: poolRewardAddressMapping,
  ) => {
    const { gaugeToPoolCache, bribeVotingToPoolCache } =
      await getCache(chainId);
    gaugeToPoolCache.add({
      [details.gaugeAddress]: {
        poolAddress: details.poolAddress,
      },
    });
    bribeVotingToPoolCache.add({
      [details.bribeVotingRewardAddress]: {
        poolAddress: details.poolAddress,
      },
    });
  };

  const getPoolAddressByGaugeAddress = async (
    chainId: string | number | bigint,
    gaugeAddress: string,
  ): Promise<string | undefined> => {
    const { gaugeToPoolCache } = await getCache(chainId);
    const result = gaugeToPoolCache.read(gaugeAddress);
    return result ? result.poolAddress : undefined;
  };

  const getPoolAddressByBribeVotingRewardAddress = async (
    chainId: string | number | bigint,
    bribeVotingRewardAddress: string,
  ): Promise<string | undefined> => {
    const { bribeVotingToPoolCache } = await getCache(chainId);
    const result = bribeVotingToPoolCache.read(bribeVotingRewardAddress);
    return result ? result.poolAddress : undefined;
  };

  return {
    getPoolAddressByBribeVotingRewardAddress,
    getPoolAddressByGaugeAddress,
    addRewardAddressDetails,
  };
};

(function () {
  const WATER_BASES = new Set(["deep_sea", "sea", "coastal_water", "inland_water"]);
  const OCEAN_BASES = new Set(["deep_sea", "sea", "coastal_water"]);
  const EVEN_Q_NEIGHBORS = [[1, 0], [0, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const ODD_Q_NEIGHBORS = [[1, 1], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, 0]];
  const TERRAIN_PROFILES = {
    deep_sea: { climate: 0, moisture: 3, elevation: -3, group: "water" },
    sea: { climate: 0, moisture: 3, elevation: -2, group: "water" },
    coastal_water: { climate: 0, moisture: 3, elevation: -1, group: "coast" },
    inland_water: { climate: 0, moisture: 3, elevation: 0, group: "freshwater" },
    beach: { climate: 0, moisture: 1, elevation: 0, group: "coast" },
    plains: { climate: 0, moisture: 0, elevation: 1, group: "fertile" },
    grassland: { climate: 0, moisture: 0, elevation: 1, group: "fertile" },
    lush_grassland: { climate: 1, moisture: 1, elevation: 1, group: "fertile" },
    wetland: { climate: 1, moisture: 2, elevation: 0, group: "wet" },
    jungle_floor: { climate: 2, moisture: 2, elevation: 1, group: "tropical" },
    desert: { climate: 1, moisture: -1, elevation: 1, group: "arid" },
    deep_desert: { climate: 1, moisture: -2, elevation: 1, group: "arid" },
    barrens: { climate: 0, moisture: -1, elevation: 1, group: "dry" },
    bleak_barrens: { climate: -1, moisture: -1, elevation: 2, group: "dry" },
    snow: { climate: -2, moisture: -1, elevation: 2, group: "cold" },
    rock: { climate: -1, moisture: -1, elevation: 3, group: "highland" },
    wastes: { climate: 0, moisture: -2, elevation: 2, group: "waste" }
  };

  function hashNumber(text) {
    let hash = 2166136261;
    for (let index = 0; index < String(text).length; index += 1) {
      hash ^= String(text).charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function makeRandom(seedText) {
    let state = hashNumber(seedText) || 1;
    return function random() {
      state += 0x6D2B79F5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, number));
  }

  function getDimensions(hexes) {
    return {
      minX: Math.min(...hexes.map(hex => hex.x)),
      maxX: Math.max(...hexes.map(hex => hex.x)),
      minY: Math.min(...hexes.map(hex => hex.y)),
      maxY: Math.max(...hexes.map(hex => hex.y))
    };
  }

  function randomBetween(random, min, max) {
    return min + random() * (max - min);
  }

  function pick(items, random) {
    return items[Math.floor(random() * items.length)] || items[0] || null;
  }

  function shuffle(items, random) {
    return [...items].sort(() => random() - 0.5);
  }

  function neighborSlots(hex, byCoord) {
    return (hex.x % 2 ? ODD_Q_NEIGHBORS : EVEN_Q_NEIGHBORS)
      .map(([dx, dy]) => byCoord.get(`${hex.x + dx}:${hex.y + dy}`) || null);
  }

  function neighbors(hex, byCoord) {
    return neighborSlots(hex, byCoord).filter(Boolean);
  }

  function isWaterBase(baseTerrain) {
    return WATER_BASES.has(baseTerrain);
  }

  function isOpenOceanBase(baseTerrain) {
    return baseTerrain === "sea" || baseTerrain === "deep_sea";
  }

  function isLandBase(baseTerrain) {
    return !isWaterBase(baseTerrain);
  }

  function nearbyWithin(hex, byCoord, radius) {
    const visited = new Set([hex.id]);
    let frontier = [hex];
    const result = [];
    for (let distance = 1; distance <= radius; distance += 1) {
      const next = [];
      frontier.forEach(current => {
        neighbors(current, byCoord).forEach(neighbor => {
          if (visited.has(neighbor.id)) return;
          visited.add(neighbor.id);
          result.push(neighbor);
          next.push(neighbor);
        });
      });
      frontier = next;
    }
    return result;
  }

  window.CampaignGeneratedMapGeneratorShared = {
    WATER_BASES,
    OCEAN_BASES,
    EVEN_Q_NEIGHBORS,
    ODD_Q_NEIGHBORS,
    TERRAIN_PROFILES,
    hashNumber,
    makeRandom,
    clamp,
    getDimensions,
    randomBetween,
    pick,
    shuffle,
    neighborSlots,
    neighbors,
    isWaterBase,
    isOpenOceanBase,
    isLandBase,
    nearbyWithin
  };
})();

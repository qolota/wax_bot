import _ from 'lodash';
import fetchAllWaxData2 from '../../core/fetchAllWaxData2';
import CONTRACTS from '../consts/CONTRACTS';
import fetchExchange from './fetchExchange';
import fetchNovoPrice from './fetchNovoPrice';
import fetchRealms from './fetchRealms';
import convertAllCosts from '../utils/convertAllCosts';
import SCHEMAS from '../consts/SCHEMAS';

const fetchUpgradeConfigs = async ({
    cache = {}
}) => {
    const exchange = cache.exchange || await fetchExchange();
    const novoPrice = cache.novoPrice || await fetchNovoPrice();
    const realms = cache.realms || await fetchRealms();
    const upgradeConfigs = await fetchAllWaxData2({
        params: {
            code: CONTRACTS.GAME,
            scope: CONTRACTS.GAME,
            table: "upnftcfg",
        },
        customProcessor: ({row}) => {
            const baseLevel = Number(row.rarity.split(' ')[1]);

            return {
                id: row.id,
                schema: row.schema,
                baseLevel,
                nextLevel: baseLevel + 1,
                resourceType: row.resource.toLowerCase(),
                realm: realms.find(r => r.name === row.realm),
                upgradeCost: convertAllCosts({
                    costs: row.cost,
                    exchange,
                    novoPrice,
                }),
            };
        },
    });

    const buildingUpgradeConfigs = _(upgradeConfigs)
        .filter(c => c.schema === SCHEMAS.BUILDING)
        .groupBy(c => `${c.resourceType}+${c.realm.name}`)
        .map((configs, key) => ({
            key,
            configs: _(configs)
                .map(config => ({
                    ...config,
                    totalWaxUpgradeCost: _(configs)
                        .filter(c => c.baseLevel <= config.baseLevel)
                        .sumBy(c => c.upgradeCost.waxCost),
                }))
                .sortBy(c => c.baseLevel)
                .value(),
        }))
        .value();
    const workerUpgradeConfigs = _(upgradeConfigs)
        .filter(c => c.schema === SCHEMAS.WORKER)
        .map(c => _.omit(c, ['resource']))
        .groupBy(c => c.realm.name)
        .map((configs, key) => ({
            key,
            configs: _(configs)
                .map(config => ({
                    ...config,
                    totalWaxUpgradeCost: _(configs)
                        .filter(c => c.baseLevel <= config.baseLevel)
                        .sumBy(c => c.upgradeCost.waxCost),
                }))
                .sortBy(c => c.baseLevel)
                .value(),
        }))
        .value();

    const configs = {
        buildings: buildingUpgradeConfigs,
        workers: workerUpgradeConfigs,
    };

    return configs;
};

export default fetchUpgradeConfigs;
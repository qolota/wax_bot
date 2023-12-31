import _ from 'lodash';
import sumResources from './sumResources';
import findResource from './findResource';

const equalizeResources = ({
    targetResources,
    currentResources,
}) => {
    const nTargetResources = sumResources({
        resources: targetResources,
    });
    const nCurrentResources = sumResources({
        resources: currentResources,
    });
    return _(nTargetResources)
        .map(targetResource => {
            const currentResource = findResource({
                resources: nCurrentResources,
                symbol: targetResource.symbol
            });

            if (currentResource == null) {
                return {
                    ...targetResource,
                };
            }

            if (currentResource.value >= targetResource.value) {
                return {
                    value: 0,
                    symbol: targetResource.symbol,
                };
            }
            

            return {
                value: _.ceil(targetResource.value - currentResource.value, 4),
                symbol: targetResource.symbol,
            }
        })
        .filter(resource => resource.value > 0)
        .value();
};

export default equalizeResources;
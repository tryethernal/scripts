const axios = require('axios');
const ethers = require('ethers');
const API_TOKEN = process.env.ETHERNAL_API_TOKEN;
const API_ROOT = process.env.ETHERNAL_API_ROOT || 'https://app-pql6sv7epq-uc.a.run.app';

axios.defaults.headers.common['authorization'] = `Bearer ${API_TOKEN}`;

const createWorkspace = (name, workspaceData) => {
    const resource = `${API_ROOT}/api/workspaces`;
    const data = {
        name: name,
        workspaceData: workspaceData
    };
    return axios.post(resource, { data });
};

const fetchTransactions = (workspace, options) => {
    const resource = `${API_ROOT}/api/transactions`;
    const params = {
        workspace: workspace,
        ...options
    };
    return axios.get(resource, { params });
};

const fetchTransaction = (workspace, hash) => {
    const resource = `${API_ROOT}/api/transactions/${hash}`;
    const params = {
        workspace: workspace,
    };
    return axios.get(resource, { params });
};

const fetchErc20Balances = (workspace, address) => {
    const params = {
        workspace: workspace,
        patterns: ['erc20']
    };
    const resource = `${API_ROOT}/api/addresses/${address}/balances`;
    return axios.get(resource, { params });
}

const main = async () => {
    // Create a new workspace
    await createWorkspace('My New Workspace', {
        chain: 'ethereum',
        networkId: 31337,
        rpcServer: 'http://localhost:8545',
        public: true
    })
    .then(({ data }) => console.log(`Created workspace "${data.name}" (#${data.id})`))
    .catch(error => console.log(error.response.data));

    /* Spin up a new Hardhat node with the following config (and require('hardhat-ethernal') in your hardhat.config.js/ts)
    {
        serverSync: true,
        apiToken: API_TOKEN, // (this is not needed if you've set ETHERNAL_API_TOKEN in your environment)
        workspace: 'My New Workspace',
        resetOnStart: 'My New Workspace' // (not mandatory but strongly recommended if the node might be restarted, this will keep explorer data in sync with the node)
    }
    */

    // Fetch the latest transactions
    await fetchTransactions('My New Workspace', { page: 1, itemsPerPage: 10 })
        .then(async  ({ data }) =>{
            // console.log(data)
            if (data.total > 0) {
                console.log(`${data.total} transactions in this workspace.`);
                if (Object.keys(data.items[0].methodDetails).length)
                    console.table(`Latest one (${data.items[0].hash}) called ${data.items[0].methodDetails.label}.`)
                await fetchTransaction('My New Workspace', data.items[0].hash)
                    .then(({ data }) => {
                        if (data.tokenTransfers.length) {
                            const transfer = data.tokenTransfers[0];
                            if (transfer.contract && transfer.contract.tokenSymbol) {
                                console.log(`It sent ${ethers.utils.formatUnits(ethers.BigNumber.from(transfer.amount), transfer.contract.tokenDecimals || 18)} ${transfer.contract.tokenSymbol} from ${transfer.src} to ${transfer.dst}`);
                            }
                            else
                                console.log(`It sent ${transfer.amount} from ${transfer.src} to ${transfer.dst}`);
                        }
                    })
                    .catch(error => console.log(error.response.data));
            }
            else
                console.log(`This workspace doesn't have transactions yet.`)
        })
        .catch(error => console.log(error.response.data));

    // Fetch & display the updated balance for an address
    await fetchErc20Balances('My New Workspace', '0x2d481eeb2ba97955cd081cf218f453a817259ab1')
        .then(({ data }) => {
            console.log(`ERC-20 balances for 0x2d481eeb2ba97955cd081cf218f453a817259ab1`)
            console.table(data.map(balance => {
                return balance.tokenContract ?
                    { token: balance.tokenContract.tokenName, balance: ethers.utils.formatUnits(ethers.BigNumber.from(balance.currentBalance), balance.tokenContract.tokenDecimals || 18) } :
                    { token: balance.token, balance: balance.currentBalance }
            }));
        })
        .catch(error => console.log(error.response.data));
    ;
}

main();


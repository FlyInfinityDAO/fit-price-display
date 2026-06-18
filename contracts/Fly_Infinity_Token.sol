// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

import {ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IFly_Infinity_Network {
    function Owner_Exists(address owner) external view returns (bool);
    function Owner_Left_Right_All(address A) external view returns (uint32, uint32);
}

contract Fly_Infinity_Token is ERC20 {
    IERC20 public DAI;
    IFly_Infinity_Network internal flyInfinityNetwork;
    address internal daoContract;

    mapping(address => uint256) internal totalPurchased;

    event PurchaseExecuted(address indexed user, uint256 amount, uint256 remaining);

    function Is_Contract(address account) private view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(account)
        }
        return size > 0;
    }

    modifier Only_Networker(address _wallet) {
        if (msg.sender != address(flyInfinityNetwork)) {
            require(flyInfinityNetwork.Owner_Exists(_wallet), "Only Networker");
        }
        _;
    }
    modifier onlyDAO() {
        require(msg.sender == daoContract, "Only DAO can call this");
        _;
    }

    constructor(address _DAI, address _flyInfinityNetwork) ERC20("Fly Infinity Token", "FIT") {
        flyInfinityNetwork = IFly_Infinity_Network(_flyInfinityNetwork);
        DAI = IERC20(_DAI);
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        require(false, "Transfers are disabled. Use buy/sell only ");
        return super.transfer(to, amount);
    }

    function transferFrom(address owner, address spender, uint256 amount) public override returns (bool) {
        require(false, "Transfers are disabled. Use buy/sell only ");
        return super.transferFrom(owner, spender, amount);
    }

    function approve(address spender, uint256 amount) public override returns (bool) {
        require(false, "Approvals are disabled. Use buy/sell only ");
        return super.approve(spender, amount);
    }

    function Price() public view returns (uint256) {
        if (totalSupply() == 0) return 1e18;
        return DAI.balanceOf(address(this)) * 1e18 / totalSupply();
    }

    function Get_Remaining_Purchase_Limit(address user) public view returns (uint256) {
        uint256 allowedLimit = Calculate_Purchase_Limit(user);
        uint256 purchased = totalPurchased[user];

        if (purchased >= allowedLimit) {
            return 0;
        }

        return allowedLimit - purchased;
    }

    function Buy(address _wallet, uint256 _amount) external Only_Networker(_wallet) returns (uint256) {
        require(_amount > 0, "DAI amount should be greater than zero.");

        uint256 allowedLimit = Calculate_Purchase_Limit(_wallet);
        uint256 newTotal;
        if (msg.sender == address(flyInfinityNetwork)) {
            newTotal = totalPurchased[_wallet];
        } else {
            newTotal = totalPurchased[_wallet] + _amount;
        }

        require(newTotal <= allowedLimit, "Purchase exceeds network activity limit");

        totalPurchased[_wallet] = newTotal;

        uint256 tokensReceived = Mint_Token(_wallet, _amount);

        emit PurchaseExecuted(_wallet, _amount, allowedLimit - newTotal);

        return tokensReceived;
    }

    function Mint_Token(address _address, uint256 _amount) private returns (uint256) {
        uint256 currentPrice = Price();

        uint256 liquidityFee = (_amount * 3) / 100;
        uint256 remainAmount = _amount - liquidityFee;

        DAI.transferFrom(msg.sender, address(this), _amount);

        uint256 userMintAmount = remainAmount * 1e18 / currentPrice;

        _mint(_address, userMintAmount);
        return userMintAmount;
    }

    function Sell(uint256 _amount) public Only_Networker(msg.sender) returns (uint256) {
        return Sell_Internal(msg.sender, _amount);
    }

    function Sell_Internal(address from, uint256 _amount) internal returns (uint256) {
        require(from != address(0), "Burn from the zero address!");
        require(_amount > 0, "Amount should be greater than zero.");
        require(balanceOf(from) >= _amount, "Insufficient balance.");

        uint256 DAIAmount = _amount * Price() / 1e18;
        uint256 liquidityFee = (DAIAmount * 6) / 100;
        uint256 sentAmount = DAIAmount - liquidityFee;

        require(DAI.balanceOf(address(this)) >= sentAmount, "Insufficient liquidity.");

        _burn(from, _amount);

        DAI.transfer(from, sentAmount);
        return sentAmount;
    }

    function Genesis_Liquidity(uint256 _amount) external {
        require(_amount > 0, "DAI amount should be greater than zero.");

        if (totalSupply() == 0) {
            require(_amount == 10e18, "Wrong initial amount.");
            uint256 frozen = 10 * 1e18;
            _mint(address(this), frozen);
        }
        DAI.transferFrom(msg.sender, address(this), _amount);
    }

    function Set_DAO_Contract(address _daoContract) external {
        require(daoContract == address(0), "DAO already set");
        require(_daoContract != address(0), "Invalid address");
        require(Is_Contract(_daoContract), "DAO address can not be wallet");
        daoContract = _daoContract;
    }

    function Change_Network_Address(address _newNetworkAddress) external onlyDAO {
        require(_newNetworkAddress != address(0), "Invalid address");
        require(_newNetworkAddress != address(flyInfinityNetwork), "Same as current address");
        require(Is_Contract(_newNetworkAddress), "New network address can not be wallet");
        flyInfinityNetwork = IFly_Infinity_Network(_newNetworkAddress);
    }

    function Owner_Info_FIT(address user)
        external
        view
        returns (uint256 purchased, uint256 allowedLimit, uint256 remaining)
    {
        uint256 limit = Calculate_Purchase_Limit(user);
        uint256 bought = totalPurchased[user];
        uint256 left = bought >= limit ? 0 : limit - bought;

        return (bought, limit, left);
    }

    function Owner_Left_Right_All(address user) external view returns (uint256, uint256) {
        return flyInfinityNetwork.Owner_Left_Right_All(user);
    }

    function Total_Purchased(address user) external view returns (uint256) {
        return totalPurchased[user];
    }

    function Fly_Infinity_DAO_Contract() external view returns (address) {
        return daoContract;
    }

    function Fly_Infinity_Network_Contract() external view returns (address) {
        return address(flyInfinityNetwork);
    }

    function Calculate_Purchase_Limit(address user) public view returns (uint256) {
        (uint32 allLeft, uint32 allRight) = flyInfinityNetwork.Owner_Left_Right_All(user);
        uint32 minSide = allLeft < allRight ? allLeft : allRight;

        uint256 totalLimit = 100 * 1e18;

        if (minSide >= 1) {
            totalLimit += 100 * 1e18;
        }
        if (minSide >= 10) {
            totalLimit += 100 * 1e18;
        }
        if (minSide >= 30) {
            totalLimit += 100 * 1e18;
        }
        if (minSide >= 100) {
            totalLimit += 1000 * 1e18;
        }
        if (minSide >= 300) {
            totalLimit += 1000 * 1e18;
        }
        if (minSide >= 1000) {
            totalLimit += 10_000 * 1e18;
        }
        if (minSide >= 3000) {
            totalLimit += 10_000 * 1e18;
        }
        if (minSide >= 10_000) {
            totalLimit += 100_000 * 1e18;
        }
        if (minSide >= 30_000) {
            totalLimit += 100_000 * 1e18;
        }
        if (minSide >= 100_000) {
            totalLimit += 1_000_000 * 1e18;
        }
        if (minSide >= 300_000) {
            totalLimit += 1_000_000 * 1e18;
        }
        if (minSide >= 1_000_000) {
            totalLimit += 10_000_000 * 1e18;
        }
        if (minSide >= 3_000_000) {
            totalLimit += 10_000_000 * 1e18;
        }
        if (minSide >= 10_000_000) {
            totalLimit += 100_000_000 * 1e18;
        }
        if (minSide >= 30_000_000) {
            totalLimit += 100_000_000 * 1e18;
        }
        if (minSide >= 100_000_000) {
            totalLimit += 1_000_000_000 * 1e18;
        }
        if (minSide >= 300_000_000) {
            totalLimit += 1_000_000_000 * 1e18;
        }
        if (minSide >= 1_000_000_000) {
            totalLimit += 10_000_000_000 * 1e18;
        }

        return totalLimit;
    }
}


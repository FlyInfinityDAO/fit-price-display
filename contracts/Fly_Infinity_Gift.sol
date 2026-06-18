// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;
import {Fly_Infinity_Network} from "./Fly_Infinity_Network.sol";
import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Fly_Infinity_Gift is Context, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Node {
        uint64 id;
        uint8 winAmount;
        uint256 winTimer;
        address Up1;
        address Up2;
    }
    mapping(address => Node) internal allGiftMembers;
    mapping(uint64 => address) internal allGiftMembersAddress;
    mapping(uint64 => bool) internal isJoinInGift;
    mapping(uint32 => address) internal giftCandidate;
    mapping(uint32 => address) internal giftWinnerAddress;
    mapping(uint32 => address) internal All_giftWinnerAddress;
    address internal Founder;
    IERC20 internal stableCoin;
    uint256 internal time;
    uint64 internal id_;
    uint32 internal giftCandidateCounter;
    uint32 internal giftWinnerCounter;
    uint32 internal All_giftWinnerCounter;
    uint32 internal Max;
    Fly_Infinity_Network internal NetworkContract;
    address internal daoContract;

    modifier onlyDAO() {
        require(_msgSender() == daoContract, "Only DAO can call this");
        _;
    }

    constructor(address _founder, address _stableCoin, address _NetworkContract) {
        Founder = _founder;
        stableCoin = IERC20(_stableCoin);
        NetworkContract = Fly_Infinity_Network(_NetworkContract);
        Max = 40;
        time = block.timestamp;
    }

    function Set_DAO_Contract(address _daoContract) external {
        require(daoContract == address(0), "DAO already set");
        require(_daoContract != address(0), "Invalid address");
        require(Is_Contract(_daoContract), "DAO address can not be wallet");
        daoContract = _daoContract;
    }

    function Change_Network_Address(address _newNetworkAddress) external onlyDAO {
        require(_newNetworkAddress != address(0), "Invalid address");
        require(_newNetworkAddress != address(NetworkContract), "Same as current address");
        require(Is_Contract(_newNetworkAddress), "New network address can not be wallet");
        NetworkContract = Fly_Infinity_Network(_newNetworkAddress);
    }

    function Join_Fly_Infinity_Gift() external {
        Join_Gift_Internal();
    }

    function Join_Gift_Internal() private {
        require(Is_Contract(_msgSender()) == false, "Just Wallet");
        require(isJoinInGift[NetworkContract.Owner_Info_Global(_msgSender()).id] == false, " You are joined");
        require(!Exist_In_Gift(_msgSender()), " You are joined ");
        require(Exist_In_Network(_msgSender()), " You are not in Fly_Infinity_Network  ");
        require(Owner_Big_Side(_msgSender()) < 90, " Big side < 90");
        require(Owner_All_Point(_msgSender()) < 1, "Just 0 Point");
        allGiftMembersAddress[id_] = _msgSender();
        id_++;
        Node memory Owner = Node({
            id: uint64(NetworkContract.Owner_Info_Global(_msgSender()).id),
            winAmount: 0,
            winTimer: 0,
            Up1: address(0),
            Up2: address(0)
        });
        allGiftMembers[_msgSender()] = Owner;
        isJoinInGift[allGiftMembers[_msgSender()].id] = true;
    }

    function Free_Fly_Infinity_Gift() external {
        require(Is_Contract(_msgSender()) == false, "Just Wallet");
        require(Exist_In_Gift(_msgSender()), " Owner not exist ");
        require(Candidate_Exist(_msgSender()) == false, " You Candidate Before ");
        require(allGiftMembers[_msgSender()].winAmount < 90, " Max 90 $ ");
        require(Owner_Big_Side(_msgSender()) < 90, "Big side < 90");
        require(Owner_All_Point(_msgSender()) < 1, "Just 0 Point");
        require(block.timestamp >= allGiftMembers[_msgSender()].winTimer + 90 hours, "You Did Win in Last 90H");
        giftCandidate[giftCandidateCounter] = _msgSender();
        giftCandidateCounter++;
        Update_UpLines(_msgSender());
    }

    function Pay_Fly_Infinity_Gift() external nonReentrant {
        require(Is_Contract(_msgSender()) == false, "Just Wallet");
        require(Exist_In_Gift(_msgSender()), " Owner not exist ");
        require(Owner_All_Point(_msgSender()) < 1, "Just 0 Point");
        require(Just_Gift_Balance() >= 90, "Fly Infinity Gift Balance Is Not Enugh ");
        require(Just_Gift_Balance() <= (giftCandidateCounter), "Number Of Candidate Not Enugh");
        giftWinnerCounter = 0;
        stableCoin.safeTransfer(_msgSender(), 3 * 10 ** 18);
        uint32 Number_Win = uint32((stableCoin.balanceOf(address(this)) / 10 ** 18) / (10));
        if (Number_Win > Max) Number_Win = Max;
        uint32 Range = giftCandidateCounter / Number_Win;
        uint32 t1 = uint32(NetworkContract.All_Owner_Number());
        uint32 temp;
        if (t1 < Range) temp = t1;
        else temp = t1 % Range;
        for (uint64 i = 0; i < Number_Win; i++) {
            stableCoin.safeTransfer(giftCandidate[temp], 5 * 10 ** 18);
            giftWinnerAddress[giftWinnerCounter] = giftCandidate[temp];
            giftWinnerCounter++;
            All_giftWinnerAddress[All_giftWinnerCounter] = giftCandidate[temp];
            All_giftWinnerCounter++;
            allGiftMembers[giftCandidate[temp]].winTimer = block.timestamp;
            allGiftMembers[giftCandidate[temp]].winAmount += 5;
            if (
                (allGiftMembers[giftCandidate[temp]].Up1 != address(0))
                    && (Winner_Exist(allGiftMembers[giftCandidate[temp]].Up1) == false)
            ) {
                stableCoin.safeTransfer(allGiftMembers[giftCandidate[temp]].Up1, 2 * 10 ** 18);
                giftWinnerAddress[giftWinnerCounter] = allGiftMembers[giftCandidate[temp]].Up1;
                giftWinnerCounter++;
                All_giftWinnerAddress[All_giftWinnerCounter] = allGiftMembers[giftCandidate[temp]].Up1;
                All_giftWinnerCounter++;
                allGiftMembers[allGiftMembers[giftCandidate[temp]].Up1].winAmount += 2;
                allGiftMembers[allGiftMembers[giftCandidate[temp]].Up1].winTimer = block.timestamp;
            }
            if (
                (allGiftMembers[giftCandidate[temp]].Up2 != address(0))
                    && (Winner_Exist(allGiftMembers[giftCandidate[temp]].Up2) == false)
            ) {
                stableCoin.safeTransfer(allGiftMembers[giftCandidate[temp]].Up2, 2 * 10 ** 18);
                giftWinnerAddress[giftWinnerCounter] = allGiftMembers[giftCandidate[temp]].Up2;
                giftWinnerCounter++;
                All_giftWinnerAddress[All_giftWinnerCounter] = allGiftMembers[giftCandidate[temp]].Up2;
                All_giftWinnerCounter++;
                allGiftMembers[allGiftMembers[giftCandidate[temp]].Up2].winAmount += 2;
                allGiftMembers[allGiftMembers[giftCandidate[temp]].Up2].winTimer = block.timestamp;
            }
            temp = temp + Range - 2;
        }
        giftCandidateCounter = 0;
        time = block.timestamp;
    }

    function Update_UpLines(address I) private {
        address tempUpLine = NetworkContract.Owner_UpLine(I);
        address temp = I;
        allGiftMembers[temp].Up1 = address(0);
        allGiftMembers[temp].Up2 = address(0);
        uint8 Counter;
        while (Counter < 2) {
            if (tempUpLine == address(0)) break;
            if (
                NetworkContract.Owner_All_Point(tempUpLine) > 3 && NetworkContract.Owner_All_Point(tempUpLine) < 30
                    && allGiftMembers[tempUpLine].winAmount < 45
                    && (block.timestamp >= allGiftMembers[tempUpLine].winTimer + 90 hours)
            ) {
                if (Exist_In_Gift(tempUpLine) == false) {
                    allGiftMembersAddress[id_] = tempUpLine;
                    id_++;
                    Node memory Owner = Node({
                        id: uint64(NetworkContract.Owner_Info_Global(tempUpLine).id),
                        winAmount: 0,
                        winTimer: 0,
                        Up1: address(0),
                        Up2: address(0)
                    });
                    allGiftMembers[tempUpLine] = Owner;
                    isJoinInGift[allGiftMembers[tempUpLine].id] = true;
                }
                if (Counter == 0) allGiftMembers[I].Up1 = tempUpLine;
                else allGiftMembers[I].Up2 = tempUpLine;
                Counter++;
            }
            temp = tempUpLine;
            tempUpLine = NetworkContract.Owner_UpLine(tempUpLine);
        }
    }

    function Candidate_Exist(address A) private view returns (bool) {
        for (uint32 i = 0; i < giftCandidateCounter; i++) {
            if (giftCandidate[i] == A) return true;
        }
        return false;
    }

    function Winner_Exist(address A) private view returns (bool) {
        for (uint32 i = 0; i < giftWinnerCounter; i++) {
            if (giftWinnerAddress[i] == A) return true;
        }
        return false;
    }

    function Is_Contract(address I) private view returns (bool) {
        uint256 size;
        assembly { size := extcodesize(I) }
        return size > 0;
    }

    function Exist_In_Gift(address ownerAddress) private view returns (bool) {
        return (allGiftMembers[ownerAddress].id != 0);
    }

    function Exist_In_Network(address ownerAddress) private view returns (bool) {
        return (NetworkContract.Owner_Info_Global(ownerAddress).id != 0);
    }

    function Owner_Big_Side(address ownerAddress) private view returns (uint32) {
        return NetworkContract.Owner_Info_Global(ownerAddress).AL >= NetworkContract.Owner_Info_Global(ownerAddress).AR
            ? NetworkContract.Owner_Info_Global(ownerAddress).AL
            : NetworkContract.Owner_Info_Global(ownerAddress).AR;
    }

    function Owner_All_Point(address ownerAddress) private view returns (uint32) {
        return NetworkContract.Owner_Info_Global(ownerAddress).AL <= NetworkContract.Owner_Info_Global(ownerAddress).AR
            ? NetworkContract.Owner_Info_Global(ownerAddress).AL
            : NetworkContract.Owner_Info_Global(ownerAddress).AR;
    }

    function Owner_Win_Gift_Amount(address ownerAddress) public view returns (uint8) {
        return allGiftMembers[ownerAddress].winAmount;
    }

    function UnLess_Gift() external {
        require(_msgSender() == Founder, " Just Founder ");
        require(block.timestamp > time + 9 hours, "UnLess Gift Time Has Not Come.");
        giftCandidateCounter = 0;
        time = block.timestamp;
        stableCoin.safeTransfer(address(NetworkContract), stableCoin.balanceOf(address(this)));
    }

    function Fly_Infinity_Network_Contract() external view returns (address) {
        return address(NetworkContract);
    }

    function Fly_Infinity_DAO_Contract() external view returns (address) {
        return daoContract;
    }

    function Just_Gift_Balance() public view returns (uint256) {
        return stableCoin.balanceOf(address(this)) / 10 ** 18;
    }

    function Just_Candidate_Number() public view returns (uint32) {
        return giftCandidateCounter;
    }

    function Owner_Info_Gift_Classic(address ownerAddress)
        external
        view
        returns (
            uint64 ID,
            address Second_UpLine,
            address First_UpLine,
            uint8 Total_Win_$,
            uint256 Last_Win_Timer_Hours
        )
    {
        Node memory node = allGiftMembers[ownerAddress];
        uint256 winPassed = node.winTimer > 0 ? (block.timestamp - node.winTimer) / 3600 : 0;
        return (node.id, node.Up2, node.Up1, node.winAmount, winPassed);
    }

    function Owner_Info_Gift(address ownerAddress) external view returns (Node memory) {
        return allGiftMembers[ownerAddress];
    }

    function Owner_Info_Network_Classic(address Owner)
        external
        view
        returns (
            uint64 ID,
            uint32 All_Left,
            uint32 All_Right,
            address UpLine_Address,
            address Left_Address,
            address Right_Address
        )
    {
        Fly_Infinity_Network.Node memory info = NetworkContract.Owner_Info_Global(Owner);
        return (info.id, info.AL, info.AR, info.UP, info.PO, info.QO);
    }

    function Max_Winner() public view returns (uint256) {
        return Max * 3;
    }

    function Set_Max_Winner(uint8 I) external {
        require(_msgSender() == Founder, "Just Founder");
        require(I < 999 && I > 9, "Just 9-999");
        Max = I;
    }

    function Last_Gift_Winner_Number() public view returns (uint256) {
        return giftWinnerCounter;
    }

    function Last_Gift_Winner_Address() public view returns (address[] memory) {
        address[] memory ret = new address[](giftWinnerCounter);
        for (uint32 i = 0; i < giftWinnerCounter; i++) {
            ret[i] = giftWinnerAddress[i];
        }
        return ret;
    }

    function All_Gift_Winner_Address(uint32 start, uint32 end) public view returns (address[] memory) {
        uint32 index;
        address[] memory ret = new address[]((end - start) + 1);
        for (uint32 i = start; i <= end; i++) {
            ret[index] = All_giftWinnerAddress[i];
            index++;
        }
        return ret;
    }

    function All_Gift_Number() public view returns (uint256) {
        return All_giftWinnerCounter;
    }

    function Migrate_Funds_To_New_Gift(address _newGiftAddress) external onlyDAO {
        require(_newGiftAddress != address(0), "Invalid address");
        require(_newGiftAddress != address(this), "Same as current address");
        require(Is_Contract(_newGiftAddress), "New gift address can not be wallet");

        uint256 balance = stableCoin.balanceOf(address(this));
        if (balance > 0) {
            stableCoin.safeTransfer(_newGiftAddress, balance);
        }
    }
}


// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;
import {Fly_Infinity_Gift} from "./Fly_Infinity_Gift.sol";
import {Fly_Infinity_Token} from "./Fly_Infinity_Token.sol";
import {Fly_Infinity_DAO} from "./Fly_Infinity_DAO.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IOldContract {
    struct Node {
        uint64 id;
        uint32 AL;
        uint32 AR;
        uint32 LT;
        uint32 RT;
        uint8 XI;
        bool YY;
        address UP;
        address PO;
        address QO;
    }

    function Owner_Info_Global(address owner) external view returns (Node memory);
    function All_Owner_Number() external view returns (uint64);
    function All_Owner_Address(uint32 start, uint32 end) external view returns (address[] memory);
    function Owner_Max_Point_Status(address owner) external view returns (bool);
}

contract Fly_Infinity_Network {
    using SafeERC20 for IERC20;
    Fly_Infinity_Gift internal fly_Gift;
    Fly_Infinity_Token internal fly_Token;
    Fly_Infinity_DAO internal daoContract;

    struct Node {
        uint64 id;
        uint32 AL;
        uint32 AR;
        uint32 LT;
        uint32 RT;
        uint8 XI;
        bool YY;
        address UP;
        address PO;
        address QO;
    }

    mapping(address => Node) internal KW;
    mapping(address => uint8) internal EE;
    mapping(uint64 => address) internal VV;
    mapping(uint64 => uint32) internal ChCr;
    mapping(uint256 => address) internal JJ;
    mapping(uint256 => uint256) internal VPL;
    mapping(uint32 => address) internal JL;
    mapping(address => bool) internal MaxPoint;
    mapping(address => bool) internal Agreement_;
    mapping(address => bool) internal supportAddresses;

    address internal Founder;
    address internal JY;
    address internal Agent;

    IERC20 internal stableCoin;
    IOldContract internal oldContract;

    uint64 internal JK;
    uint24 internal DJ;
    uint32 internal ZL;
    uint256 internal time;
    uint256 internal RCr;
    uint256 internal ZM;
    uint256 internal DZ;
    uint256 internal LZ;
    uint256 internal rewardFee;
    uint256 internal newMember;
    uint64 internal lastBatch;
    bool internal changeSwitch;

    bool internal Waiting;
    bool internal importCompleted;

    string internal Road_Map;
    string internal Token_Road_Map;
    string public Founder_Message;

    modifier onlyDAO() {
        require(msg.sender == address(daoContract), "Only DAO can call this");
        _;
    }

    constructor(
        address _Founder,
        address _Agent,
        address _stableCoin,
        address _oldContract,
        address[4] memory _supportAddresses
    ) {
        Founder = _Founder;
        stableCoin = IERC20(_stableCoin);
        Agent = _Agent;
        oldContract = IOldContract(_oldContract);
        time = block.timestamp;
        fly_Gift = new Fly_Infinity_Gift(_Founder, _stableCoin, address(this));
        fly_Token = new Fly_Infinity_Token(_stableCoin, address(this));
        daoContract = new Fly_Infinity_DAO(_Founder, address(this), address(fly_Token), address(fly_Gift));
        fly_Gift.Set_DAO_Contract(address(daoContract));
        fly_Token.Set_DAO_Contract(address(daoContract));
        stableCoin.approve(address(fly_Token), type(uint256).max);
        for (uint256 i = 0; i < _supportAddresses.length; i++) {
            supportAddresses[_supportAddresses[i]] = true;
        }
    }

    function Change_Gift_Address(address _newGiftAddress) external onlyDAO {
        require(_newGiftAddress != address(0), "Invalid address");
        require(_newGiftAddress != address(fly_Gift), "Same as current address");
        require(Is_Contract(_newGiftAddress), "New gift address can not be wallet");
        fly_Gift = Fly_Infinity_Gift(_newGiftAddress);
    }

    function Import_Batch(uint64 batchSize) external {
        require(importCompleted == false, "Import already completed");
        require(Waiting == false, "Processing");
        uint64 start = lastBatch;
        uint64 end = lastBatch + batchSize;
        lastBatch += batchSize;
        if (lastBatch >= oldContract.All_Owner_Number()) {
            end = oldContract.All_Owner_Number();
            importCompleted = true;
        }

        Waiting = true;

        address[] memory importAddresses = oldContract.All_Owner_Address(uint32(start), uint32(end - 1));

        for (uint32 i = 0; i < importAddresses.length; i++) {
            address user = importAddresses[i];
            IOldContract.Node memory oldNode = oldContract.Owner_Info_Global(user);
            if (Owner_Exists(user)) continue;
            if (user == address(0)) continue;
            bool maxPoints = oldContract.Owner_Max_Point_Status(user);

            Import_User(
                user,
                oldNode.AL,
                oldNode.AR,
                oldNode.LT,
                oldNode.RT,
                oldNode.XI,
                oldNode.YY,
                oldNode.UP,
                oldNode.PO,
                oldNode.QO,
                maxPoints
            );
        }

        Waiting = false;
    }

    function Import_Single(address owner) external {
        // Remove the importCompleted check entirely
        require(Waiting == false, "Processing");
        require(!Owner_Exists(owner), "User already exists");

        Waiting = true;

        IOldContract.Node memory oldNode = oldContract.Owner_Info_Global(owner);
        require(oldNode.id != 0, "User does not exist in old contract");

        bool maxPoints = oldContract.Owner_Max_Point_Status(owner);

        // Use current Import_User - it assigns VV[JK] and increments JK
        Import_User(
            owner,
            oldNode.AL,
            oldNode.AR,
            oldNode.LT,
            oldNode.RT,
            oldNode.XI,
            oldNode.YY,
            oldNode.UP,
            oldNode.PO,
            oldNode.QO,
            maxPoints
        );

        Waiting = false;
    }

    function Import_User(
        address owner,
        uint32 allLeft,
        uint32 allRight,
        uint32 left,
        uint32 right,
        uint8 directNumber,
        bool leftOrRight,
        address upLineAddress,
        address leftAddress,
        address rightAddress,
        bool maxPoints
    ) private {
        VV[JK] = owner;
        JK++;

        Node memory newNode = Node({
            id: JK,
            AL: allLeft,
            AR: allRight,
            LT: left,
            RT: right,
            XI: directNumber,
            YY: leftOrRight,
            UP: upLineAddress,
            PO: leftAddress,
            QO: rightAddress
        });

        KW[owner] = newNode;
        MaxPoint[owner] = maxPoints;
    }

    function Import_Status() external view returns (bool) {
        return importCompleted;
    }

    function BeCome_Owner(address Up) external {
        Become_Owner_Internal(Up);
    }

    function Become_Owner_Internal(address Up) private {
        require(importCompleted, "Import not completed yet");
        require(Is_Contract(msg.sender) == false, "Just Wallet");
        require(Up != address(0), " Dont Enter address 0 ");
        require(KW[Up].XI != 2, " Upline Has 2 Directs ");
        require(msg.sender != Up, " Dont Enter Your Address ");
        require(!Owner_Exists_Internal(msg.sender), " You Are An Owner ");
        require(Owner_Exists_Internal(Up), " Upline Not Exist ");
        require(Agreement_[msg.sender] == true, " Write Agreement");
        require(Waiting == false, " Processing ");
        Waiting = true;
        stableCoin.safeTransferFrom(msg.sender, address(this), 100 * 10 ** 18);
        IERC20(stableCoin).safeTransfer(address(fly_Gift), 5 * 10 ** 18);
        fly_Token.Buy(msg.sender, 2 * 10 ** 18);
        VV[JK] = msg.sender;
        JK++;
        Node memory owner = Node({
            id: JK,
            AL: 0,
            AR: 0,
            LT: 0,
            RT: 0,
            XI: 0,
            YY: KW[Up].XI == 0 ? false : true,
            UP: Up,
            PO: address(0),
            QO: address(0)
        });
        KW[msg.sender] = owner;
        JJ[newMember] = msg.sender;
        DZ++;
        newMember++;
        if (KW[Up].XI == 0) {
            KW[Up].LT++;
            KW[Up].AL++;
            KW[Up].PO = msg.sender;
        } else {
            KW[Up].RT++;
            KW[Up].AR++;
            KW[Up].QO = msg.sender;
        }
        KW[Up].XI++;
        Waiting = false;
    }

    function Reward() external {
        Reward_Internal();
    }

    function Reward_Internal() private {
        require(importCompleted, "Import not completed yet");
        require(Is_Contract(msg.sender) == false, "Just Wallet");
        require(Owner_All_Point(msg.sender) > 0, "Just NetWorker");
        require(block.timestamp > time + 1 hours, " Reward Time Has Not Come ");
        Point_BroadCast_Internal();
        require(Total_Point() > 0, " Total Point Is 0 ");
        require(Waiting == false, " Processing ");
        Waiting = true;
        ZL = Total_Point();
        JY = msg.sender;
        uint256 ZO = Point_Value();
        ZM = ZO;
        RCr++;
        VPL[RCr] = ZO;
        uint256 D_T = ((DZ * rewardFee * 10 ** 18) / 2);
        for (uint24 i = 0; i < DJ; i++) {
            Node memory ZN = KW[JL[i]];
            uint32 UT = Min_Point(JL[i]);
            if (ZN.LT == UT) {
                ZN.LT = 0;
                ZN.RT -= UT;
            } else if (ZN.RT == UT) {
                ZN.LT -= UT;
                ZN.RT = 0;
            } else {
                if (ZN.LT < ZN.RT) {
                    ZN.RT -= ZN.LT;
                    ZN.LT = 0;
                } else {
                    ZN.LT -= ZN.RT;
                    ZN.RT = 0;
                }
            }
            KW[JL[i]] = ZN;
            if (Owner_All_Point(JL[i]) < 100) {
                if (UT * ZO > stableCoin.balanceOf(address(this))) {
                    stableCoin.safeTransfer(Check_Support(JL[i]), stableCoin.balanceOf(address(this)));
                } else {
                    stableCoin.safeTransfer(Check_Support(JL[i]), UT * ZO);
                }
            } else {
                if (((UT * ZO * 9) / 10) > stableCoin.balanceOf(address(this))) {
                    stableCoin.safeTransfer(Check_Support(JL[i]), stableCoin.balanceOf(address(this)));
                } else {
                    stableCoin.safeTransfer(Check_Support(JL[i]), ((UT * ZO * 9) / 10));
                }
            }
        }
        if (D_T <= stableCoin.balanceOf(address(this))) {
            stableCoin.safeTransfer(msg.sender, D_T);
        }
        stableCoin.safeTransfer(address(fly_Token), stableCoin.balanceOf(address(this)));
        time = block.timestamp;
        DZ = 0;
        newMember = 0;
        LZ = 0;
        DJ = 0;
        Waiting = false;
    }

    function Check_Support(address owner) private view returns (address) {
        if (supportAddresses[owner]) {
            return address(fly_Token);
        }
        return owner;
    }

    function Point_BroadCast() external {
        require(Is_Contract(msg.sender) == false, "Just Wallet");
        require(Owner_Exists_Internal(msg.sender), "Owner Not Exist");
        require(newMember >= 5, " After 5 BeCome_Owner ");
        require(Waiting == false, " Processing ");
        Waiting = true;
        Point_BroadCast_Internal();
        newMember = 0;
        Waiting = false;
    }

    function Point_BroadCast_Internal() private {
        address ZC;
        address ZD;
        for (uint256 k = 0; k < newMember; k++) {
            ZC = KW[KW[JJ[k]].UP].UP;
            ZD = KW[JJ[k]].UP;
            if (Can_Reward(ZD) == true) {
                JL[DJ] = ZD;
                DJ++;
            }
            while (ZC != address(0)) {
                if (KW[ZD].YY == false) {
                    KW[ZC].LT++;
                    KW[ZC].AL++;
                } else {
                    KW[ZC].RT++;
                    KW[ZC].AR++;
                }
                if (Can_Reward(ZC) == true) {
                    JL[DJ] = ZC;
                    DJ++;
                }
                ZD = ZC;
                ZC = KW[ZC].UP;
            }
        }
    }

    function _Change_Wallet(address I) external {
        require(importCompleted, "Import not completed yet");
        require(I != address(0), "Dont Enter address 0");
        require(changeSwitch == true, "Do After ChangeSwitch");
        require(Owner_Exists_Internal(msg.sender), "You Are Not Exist");
        require(Is_Contract(I) == false, "New address can not be contract");
        require(Is_Reward_Time(msg.sender), " Do After Reward");
        if (Owner_All_Point(msg.sender) > 1000) {
            require(ChCr[KW[msg.sender].id] < 8, "Just 8 Times");
        } else {
            require(ChCr[KW[msg.sender].id] < 3, "Just 3 Times");
        }
        require(!Owner_Exists_Internal(I), "New Address Exist!");
        require(Owner_Exists_Internal(KW[msg.sender].UP), "Your UpLine Not Exist");
        require(Waiting == false, "Processing");
        Waiting = true;
        if (Check_Support(msg.sender) != msg.sender) {
            supportAddresses[I] = true;
        }
        Node memory F = KW[msg.sender];
        VV[F.id - 1] = I;
        Node memory B = KW[F.PO];
        B.UP = I;
        KW[F.PO] = B;
        Node memory C = KW[F.QO];
        C.UP = I;
        KW[F.QO] = C;
        Node memory U = KW[F.UP];
        if (F.YY == false) {
            U.PO = I;
        } else {
            U.QO = I;
        }
        KW[F.UP] = U;
        KW[I] = F;
        ChCr[KW[I].id]++;
        ChCr[KW[msg.sender].id]++;
        delete KW[msg.sender];
        Waiting = false;
    }

    function Dont_Change_Wallet() external {
        require(importCompleted, "Import not completed yet");
        require(Owner_Exists_Internal(msg.sender), "Owner Not Exist");
        ChCr[KW[msg.sender].id] = 8;
    }

    function Owner_Exists_Internal(address F) private view returns (bool) {
        return (KW[F].id != 0);
    }

    function Can_Reward(address F) private view returns (bool) {
        if (Min_Point(F) > 0) {
            for (uint24 i = 0; i < DJ; i++) {
                if (JL[i] == F) {
                    return false;
                }
            }
            return true;
        } else {
            return false;
        }
    }

    function Total_Point() private view returns (uint32) {
        uint32 AA;
        for (uint24 i = 0; i < DJ; i++) {
            AA += Min_Point(JL[i]);
        }
        return AA;
    }

    function Min_Point(address F) private view returns (uint32) {
        uint32 min = KW[F].LT <= KW[F].RT ? KW[F].LT : KW[F].RT;
        if (MaxPoint[F] == false) {
            if (min > 5) {
                min = 5;
            }
        } else {
            if (min > 10) {
                min = 10;
            }
        }
        return min;
    }

    function Is_Reward_Time(address F) private view returns (bool) {
        for (uint256 i = 0; i < DZ; i++) {
            if (JJ[i] == F) {
                return false;
            }
        }
        return true;
    }

    function Is_Contract(address F) private view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(F)
        }
        return size > 0;
    }

    function Point_Value() private view returns (uint256) {
        return (stableCoin.balanceOf(address(this)) - (DZ * 3 * 10 ** 18)) / Total_Point();
    }

    function Owner_Exists(address owner) public view returns (bool) {
        return Owner_Exists_Internal(owner);
    }

    function Add_Approve_DAI() external view returns (address) {
        return address(stableCoin);
    }

    function All_Owner_Number() public view returns (uint64) {
        return JK;
    }

    function All_Owner_Address(uint32 start, uint32 end) public view returns (address[] memory) {
        uint32 index;
        address[] memory ret = new address[]((end - start) + 1);
        for (uint32 i = start; i <= end; i++) {
            ret[index] = VV[i];
            index++;
        }
        return ret;
    }

    function Last_Value_Point() public view returns (uint256) {
        return ZM / 10 ** 18;
    }

    function Last_Reward_Writer() public view returns (address) {
        return JY;
    }

    function Last_Total_Point() public view returns (uint32) {
        return ZL;
    }

    function Last_Value_Points_Average(uint256 I) external view returns (uint256) {
        require(I <= RCr, " Out Of Range ");
        uint256 Lv = 0;
        for (uint256 i = RCr; i > (RCr - I); i--) {
            Lv += (VPL[i] / 10 ** 18);
        }
        return (Lv / I);
    }

    function Just_Contract_Balance() public view returns (uint256) {
        return stableCoin.balanceOf(address(this)) / 10 ** 18;
    }

    function Owner_Info_Classic(address owner)
        external
        view
        returns (
            uint64 ID,
            uint32 All_Left,
            uint32 All_Right,
            uint32 Left,
            uint32 Right,
            address UpLine_Address,
            address Left_Address,
            address Right_Address
        )
    {
        Node memory node = KW[owner];
        return (node.id, node.AL, node.AR, node.LT, node.RT, node.UP, node.PO, node.QO);
    }

    function Owner_Big_Side(address F) public view returns (uint32) {
        return KW[F].AL >= KW[F].AR ? KW[F].AL : KW[F].AR;
    }

    function Owner_All_Point(address F) public view returns (uint32) {
        return KW[F].AL <= KW[F].AR ? KW[F].AL : KW[F].AR;
    }

    function Owner_Info_Global(address F) public view returns (Node memory) {
        return KW[F];
    }

    function Owner_UpLine(address F) public view returns (address) {
        return KW[F].UP;
    }

    function Owner_Directs(address F) public view returns (address, address) {
        return (KW[F].PO, KW[F].QO);
    }

    function Owner_Left_Right_All(address F) public view returns (uint32, uint32) {
        return (KW[F].AL, KW[F].AR);
    }

    function Owner_Left_Right_Save(address F) public view returns (uint32, uint32) {
        return (KW[F].LT, KW[F].RT);
    }

    function Owner_All_Team(address F) public view returns (uint32) {
        return (KW[F].AL + KW[F].AR);
    }

    function Fly_Infinity_Token_Contract() external view returns (Fly_Infinity_Token) {
        return fly_Token;
    }

    function Fly_Infinity_Gift_Contract() external view returns (Fly_Infinity_Gift) {
        return fly_Gift;
    }

    function Fly_Infinity_DAO_Contract() external view returns (Fly_Infinity_DAO) {
        return daoContract;
    }

    function _Set_Reward_Fee(uint256 F) external {
        require(msg.sender == Agent, "Just Agent");
        require(F <= 5 && F > 0, "Just 1-5");
        rewardFee = F;
    }

    function Reward_Fee_Status() public view returns (uint256) {
        return rewardFee;
    }

    function _Switch_Change_Status() public view returns (bool) {
        return changeSwitch;
    }

    function Reward_Counter_Status() public view returns (uint256) {
        return RCr;
    }

    function _New_Owner_Status() public view returns (uint256) {
        return newMember;
    }

    function Owner_UpLines_All_Address(address F) public view returns (address[] memory) {
        address[] memory OUAL = new address[](JK);
        uint32 OUAC;
        address _D_UpLine = KW[F].UP;
        address _D = F;
        while (_D != address(0)) {
            OUAL[OUAC] = _D_UpLine;
            OUAC++;
            _D = _D_UpLine;
            _D_UpLine = KW[_D_UpLine].UP;
        }
        address[] memory ret = new address[](OUAC);
        for (uint32 i = 0; i < OUAC; i++) {
            ret[i] = OUAL[i];
        }
        return ret;
    }

    function Max_Point(address Left_100, address Right_100) external {
        Max_Point_Internal(Left_100, Right_100);
    }

    function Max_Point_Internal(address Left_100, address Right_100) private {
        require(importCompleted, "Import not completed yet");
        require(Owner_Exists_Internal(msg.sender), "Owner Not Exist");
        require(MaxPoint[msg.sender] == false, "You Did Max_Point");
        require(Owner_Is_My_Line(KW[msg.sender].PO, Left_100) == true, "Left_100 is not your line");
        require(Owner_Is_My_Line(KW[msg.sender].QO, Right_100) == true, "Right_100 is not your line");
        require(Owner_All_Point(Left_100) >= 100, "Left_100 is not +100 point");
        require(Owner_All_Point(Right_100) >= 100, "Right_100 is not +100 point");
        MaxPoint[msg.sender] = true;
    }

    function Owner_Is_My_Line(address Up_Line, address Down_Line) public view returns (bool) {
        if (Up_Line == Down_Line) {
            return true;
        } else {
            address E = KW[Down_Line].UP;
            bool temp;
            while (E != address(0)) {
                if (E == Up_Line) {
                    temp = true;
                    break;
                }
                E = KW[E].UP;
            }
            if (temp) {
                return true;
            } else {
                return false;
            }
        }
    }

    function Agreement_Road_Map() external {
        require(Is_Contract(msg.sender) == false, "Just Wallet");
        require(Agreement_[msg.sender] == false, "You Did Before ");
        Agreement_[msg.sender] = true;
    }

    function Owner_Max_Point_Status(address Owner) public view returns (bool) {
        return MaxPoint[Owner];
    }

    function UnLess_Reward() external {
        require(importCompleted, "Import not completed yet");
        require(Owner_All_Point(msg.sender) > 1000, "Just +1000");
        require(block.timestamp > time + 4 hours, "UnLess_Reward Time Has Not Come");
        newMember = 0;
        LZ = 0;
        DJ = 0;
        Waiting = false;
    }

    function _Switch_Change() external {
        require(msg.sender == Agent, "Just Agent");
        if (changeSwitch == false) {
            changeSwitch = true;
        } else {
            changeSwitch = false;
        }
    }

    function Write_Road_Map(string memory I) public {
        require(msg.sender == Founder, " Just Founder ");
        Road_Map = I;
    }

    function Write_Token_Road_Map(string memory I) public {
        require(msg.sender == Founder, " Just Founder ");
        Token_Road_Map = I;
    }

    function Write_Founder_Message(string memory F) public {
        require(msg.sender == Founder, " Just Founder ");
        Founder_Message = F;
    }

    function Road_Map_() public view returns (string memory) {
        return Road_Map;
    }

    function Token_Road_Map_() public view returns (string memory) {
        return Token_Road_Map;
    }

    function Migrate_Funds_To_New_Network(address _newNetwork) external onlyDAO {
        require(_newNetwork != address(0), "Invalid address");
        require(_newNetwork != address(this), "Same as current address");
        require(Is_Contract(_newNetwork), "New address can not be wallet");

        uint256 balance = stableCoin.balanceOf(address(this));
        if (balance > 0) {
            stableCoin.safeTransfer(_newNetwork, balance);
        }
    }
}


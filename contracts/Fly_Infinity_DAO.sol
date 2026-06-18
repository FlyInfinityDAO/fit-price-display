// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

interface IFly_Infinity_Network_DAO {
    function Owner_Exists(address owner) external view returns (bool);
}

interface IFly_Infinity_Token_DAO {
    function Change_Network_Address(address newAddress) external;
}

interface IFly_Infinity_Gift_DAO {
    function Change_Network_Address(address newAddress) external;
    function Migrate_Funds_To_New_Gift(address newAddress) external;
}

interface IFly_Infinity_Network_Changeable {
    function Change_Gift_Address(address newAddress) external;
    function Migrate_Funds_To_New_Network(address newAddress) external;
}

contract Fly_Infinity_DAO {
    enum ProposalType {
        CHANGE_NETWORK_ADDRESS,
        CHANGE_GIFT_ADDRESS
    }

    enum ProposalStatus {
        Active,
        Executed,
        Rejected,
        Expired
    }

    struct Proposal {
        uint256 id;
        ProposalType proposalType;
        address proposedAddress;
        address proposer;
        uint256 startTime;
        uint256 endTime;
        uint256 positiveVotes;
        uint256 negativeVotes;
        ProposalStatus status;
        mapping(address => bool) hasVoted;
        mapping(address => bool) voteChoice;
    }

    address internal founder;
    address internal networkContract;
    address internal tokenContract;
    address internal giftContract;

    uint256 public constant VOTING_PERIOD = 3 days;
    uint256 internal proposalCounter = 1;
    uint256 public Active_Proposal_ID;
    bool public Has_Active_Proposal;

    mapping(uint256 => Proposal) internal proposals;

    function Is_Contract(address account) internal view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(account)
        }
        return size > 0;
    }

    event ProposalCreated(
        uint256 indexed proposalId,
        ProposalType proposalType,
        address proposedAddress,
        address proposer,
        uint256 startTime,
        uint256 endTime
    );

    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support);

    event ProposalExecuted(uint256 indexed proposalId, ProposalType proposalType, address newAddress);

    event ProposalRejected(uint256 indexed proposalId, uint256 positiveVotes, uint256 negativeVotes);

    event ProposalExpired(uint256 indexed proposalId);

    event VOTING_PERIODChanged(uint256 oldPeriod, uint256 newPeriod);

    modifier Only_Founder() {
        require(msg.sender == founder, "Only founder can call this");
        _;
    }

    modifier Only_Networker() {
        require(IFly_Infinity_Network_DAO(networkContract).Owner_Exists(msg.sender), "Only networkers can vote");
        _;
    }

    modifier No_Active_Proposal() {
        require(!Has_Active_Proposal, "Another proposal is active");
        _;
    }

    constructor(address _initialFounder, address _networkContract, address _tokenContract, address _giftContract) {
        founder = _initialFounder;
        networkContract = _networkContract;
        tokenContract = _tokenContract;
        giftContract = _giftContract;
        Has_Active_Proposal = false;
    }

    function Propose_Network_Address_Change(address _newNetworkAddress)
        external
        Only_Founder
        No_Active_Proposal
        returns (uint256)
    {
        require(_newNetworkAddress != address(0), "Invalid address");
        require(_newNetworkAddress != networkContract, "Same as current address");
        require(Is_Contract(_newNetworkAddress), "Address can not be wallet");

        uint256 proposalId = proposalCounter++;
        Proposal storage proposal = proposals[proposalId];

        proposal.id = proposalId;
        proposal.proposalType = ProposalType.CHANGE_NETWORK_ADDRESS;
        proposal.proposedAddress = _newNetworkAddress;
        proposal.proposer = msg.sender;
        proposal.startTime = block.timestamp;
        proposal.endTime = block.timestamp + VOTING_PERIOD;
        proposal.status = ProposalStatus.Active;

        Active_Proposal_ID = proposalId;
        Has_Active_Proposal = true;

        emit ProposalCreated(
            proposalId,
            ProposalType.CHANGE_NETWORK_ADDRESS,
            _newNetworkAddress,
            msg.sender,
            proposal.startTime,
            proposal.endTime
        );

        return proposalId;
    }

    function Propose_Gift_Address_Change(address _newGiftAddress)
        external
        Only_Founder
        No_Active_Proposal
        returns (uint256)
    {
        require(_newGiftAddress != address(0), "Invalid address");
        require(_newGiftAddress != giftContract, "Same as current address");
        require(Is_Contract(_newGiftAddress), "Address can not be wallet");

        uint256 proposalId = proposalCounter++;
        Proposal storage proposal = proposals[proposalId];

        proposal.id = proposalId;
        proposal.proposalType = ProposalType.CHANGE_GIFT_ADDRESS;
        proposal.proposedAddress = _newGiftAddress;
        proposal.proposer = msg.sender;
        proposal.startTime = block.timestamp;
        proposal.endTime = block.timestamp + VOTING_PERIOD;
        proposal.status = ProposalStatus.Active;

        Active_Proposal_ID = proposalId;
        Has_Active_Proposal = true;

        emit ProposalCreated(
            proposalId,
            ProposalType.CHANGE_GIFT_ADDRESS,
            _newGiftAddress,
            msg.sender,
            proposal.startTime,
            proposal.endTime
        );

        return proposalId;
    }

    function Vote(bool _support) external Only_Networker {
        require(Has_Active_Proposal, "No active proposal");

        Proposal storage proposal = proposals[Active_Proposal_ID];

        require(proposal.status == ProposalStatus.Active, "Proposal not active");
        require(block.timestamp <= proposal.endTime, "Voting period ended.");
        require(!proposal.hasVoted[msg.sender], "Already voted.");

        proposal.hasVoted[msg.sender] = true;
        proposal.voteChoice[msg.sender] = _support;

        if (_support) {
            proposal.positiveVotes++;
        } else {
            proposal.negativeVotes++;
        }

        emit VoteCast(Active_Proposal_ID, msg.sender, _support);
    }

    function Execute_Proposal() external {
        require(Has_Active_Proposal, "No active proposal");

        Proposal storage proposal = proposals[Active_Proposal_ID];

        require(proposal.status == ProposalStatus.Active, "Proposal not active");
        require(block.timestamp > proposal.endTime, "Voting period not ended");

        if (proposal.positiveVotes > proposal.negativeVotes) {
            proposal.status = ProposalStatus.Executed;

            if (proposal.proposalType == ProposalType.CHANGE_NETWORK_ADDRESS) {
                IFly_Infinity_Network_Changeable(networkContract).Migrate_Funds_To_New_Network(proposal.proposedAddress);
                IFly_Infinity_Token_DAO(tokenContract).Change_Network_Address(proposal.proposedAddress);
                IFly_Infinity_Gift_DAO(giftContract).Change_Network_Address(proposal.proposedAddress);

                networkContract = proposal.proposedAddress;
            } else if (proposal.proposalType == ProposalType.CHANGE_GIFT_ADDRESS) {
                IFly_Infinity_Gift_DAO(giftContract).Migrate_Funds_To_New_Gift(proposal.proposedAddress);
                IFly_Infinity_Network_Changeable(networkContract).Change_Gift_Address(proposal.proposedAddress);

                giftContract = proposal.proposedAddress;
            }

            emit ProposalExecuted(Active_Proposal_ID, proposal.proposalType, proposal.proposedAddress);
        } else {
            proposal.status = ProposalStatus.Rejected;
            emit ProposalRejected(Active_Proposal_ID, proposal.positiveVotes, proposal.negativeVotes);
        }

        Has_Active_Proposal = false;
    }

    function Mark_Expired() external {
        require(Has_Active_Proposal, "No active proposal");

        Proposal storage proposal = proposals[Active_Proposal_ID];

        require(proposal.status == ProposalStatus.Active, "Proposal not active");
        require(block.timestamp > proposal.endTime + 1 days, "Not expired yet");

        proposal.status = ProposalStatus.Expired;
        Has_Active_Proposal = false;

        emit ProposalExpired(Active_Proposal_ID);
    }

    function Get_Active_Proposal_Id() external view returns (uint256) {
        require(Has_Active_Proposal, "No active proposal");
        return Active_Proposal_ID;
    }

    function Get_Active_Proposal()
        external
        view
        returns (
            uint256 id,
            ProposalType proposalType,
            address proposedAddress,
            address proposer,
            uint256 startTime,
            uint256 endTime,
            uint256 positiveVotes,
            uint256 negativeVotes,
            ProposalStatus status
        )
    {
        require(Has_Active_Proposal, "No active proposal");
        Proposal storage proposal = proposals[Active_Proposal_ID];
        return (
            proposal.id,
            proposal.proposalType,
            proposal.proposedAddress,
            proposal.proposer,
            proposal.startTime,
            proposal.endTime,
            proposal.positiveVotes,
            proposal.negativeVotes,
            proposal.status
        );
    }

    function Get_Proposal(uint256 _proposalId)
        external
        view
        returns (
            uint256 id,
            ProposalType proposalType,
            address proposedAddress,
            address proposer,
            uint256 startTime,
            uint256 endTime,
            uint256 positiveVotes,
            uint256 negativeVotes,
            ProposalStatus status
        )
    {
        Proposal storage proposal = proposals[_proposalId];
        return (
            proposal.id,
            proposal.proposalType,
            proposal.proposedAddress,
            proposal.proposer,
            proposal.startTime,
            proposal.endTime,
            proposal.positiveVotes,
            proposal.negativeVotes,
            proposal.status
        );
    }

    function Has_Voted(address _voter) external view returns (bool) {
        require(Has_Active_Proposal, "No active proposal");
        return proposals[Active_Proposal_ID].hasVoted[_voter];
    }

    function Has_Voted_On_Proposal(uint256 _proposalId, address _voter) external view returns (bool) {
        return proposals[_proposalId].hasVoted[_voter];
    }

    function Get_Vote_Choice(address _voter) external view returns (bool) {
        require(Has_Active_Proposal, "No active proposal");
        require(proposals[Active_Proposal_ID].hasVoted[_voter], "Has not voted");
        return proposals[Active_Proposal_ID].voteChoice[_voter];
    }

    function Get_Vote_Choice_On_Proposal(uint256 _proposalId, address _voter) external view returns (bool) {
        require(proposals[_proposalId].hasVoted[_voter], "Has not voted");
        return proposals[_proposalId].voteChoice[_voter];
    }

    function Get_Time_Remaining() external view returns (uint256) {
        require(Has_Active_Proposal, "No active proposal");
        Proposal storage proposal = proposals[Active_Proposal_ID];
        if (block.timestamp >= proposal.endTime) {
            return 0;
        }
        return proposal.endTime - block.timestamp;
    }

    function Can_Execute() external view returns (bool) {
        if (!Has_Active_Proposal) return false;

        Proposal storage proposal = proposals[Active_Proposal_ID];
        return (proposal.status == ProposalStatus.Active && block.timestamp > proposal.endTime
                && proposal.positiveVotes > proposal.negativeVotes);
    }

    function Fly_Infinity_Network_Contract() external view returns (address) {
        return networkContract;
    }

    function Fly_Infinity_Gift_Contract() public view returns (address) {
        return giftContract;
    }

    function Fly_Infinity_Token_Contract() external view returns (address) {
        return tokenContract;
    }
}


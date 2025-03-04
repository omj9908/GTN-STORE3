// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.3/contracts/token/ERC20/IERC20.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.3/contracts/token/ERC721/ERC721.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.3/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.3/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.3/contracts/access/Ownable.sol";

contract NFTStore is ERC721, ERC721URIStorage, ERC721Enumerable, Ownable {
    IERC20 public gtnToken;
    uint256 private _tokenIds;
    mapping(uint256 => uint256) public nftPrices;
    mapping(uint256 => bool) public isNFTForSale;
    mapping(uint256 => string) public nftNames;
    mapping(uint256 => string) public nftDescriptions;

    event NFTMinted(address indexed owner, uint256 tokenId, string metadataURI);
    event NFTPurchased(address indexed buyer, uint256 tokenId, uint256 price);
    
    constructor(address gtnTokenAddress) ERC721("GameNFT", "GNFT") {
        gtnToken = IERC20(gtnTokenAddress);
    }

    function mintNFT(
        string memory name, 
        string memory description, 
        string memory metadataURI, 
        uint256 price)
        external onlyOwner returns (uint256) {
            _tokenIds++;
            uint256 newItemId = _tokenIds;
            _safeMint(msg.sender, newItemId);
            _setTokenURI(newItemId, metadataURI);
            nftPrices[newItemId] = price;
            isNFTForSale[newItemId] = false; // ✅ 명확하게 false 설정
            nftNames[newItemId] = name;
            nftDescriptions[newItemId] = description;
            emit NFTMinted(msg.sender, newItemId, metadataURI);
            return newItemId;
            }

    function getNFTInfo(uint256 tokenId) 
    external view 
    returns (string memory, string memory, string memory, uint256, bool) 
    {
        require(_exists(tokenId), "NFT does not exist");
        return (
            nftNames[tokenId],
            nftDescriptions[tokenId],
            tokenURI(tokenId),
            nftPrices[tokenId],
            isNFTForSale[tokenId] // ✅ 판매 여부 반환
            );
    }

    // ✅ NFT 구매 기능
    function buyNFT(uint256 tokenId) external {
        require(isNFTForSale[tokenId], "NFT is not for sale");
        require(nftPrices[tokenId] > 0, "NFT price not set");
        require(gtnToken.balanceOf(msg.sender) >= nftPrices[tokenId], "Insufficient GTN balance");

        uint256 allowance = gtnToken.allowance(msg.sender, address(this));
        require(allowance >= nftPrices[tokenId], "GTNToken approval required");

        gtnToken.transferFrom(msg.sender, owner(), nftPrices[tokenId]);

        _transfer(owner(), msg.sender, tokenId);
        isNFTForSale[tokenId] = false;

        emit NFTPurchased(msg.sender, tokenId, nftPrices[tokenId]);
    }

    // ✅ 현재 판매 중인 NFT 목록 조회
    function getNFTsForSale() external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i <= _tokenIds; i++) {
            if (isNFTForSale[i]) {
                count++;
            }
        }

        uint256[] memory availableNFTs = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 1; i <= _tokenIds; i++) {
            if (isNFTForSale[i]) {
                availableNFTs[index] = i;
                index++;
            }
        }

        return availableNFTs;
    }

    function getOwnedNFTs(address user) external view returns (uint256[] memory) {
        uint256 count = balanceOf(user);

        if (count == 0) {
            return new uint256[](0);
        }

        uint256[] memory ownedNFTs = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            ownedNFTs[i] = tokenOfOwnerByIndex(user, i);
        }
        return ownedNFTs;
    }

    // ✅ `tokenURI` 함수 수정 (명확한 오버라이딩)
    function tokenURI(uint256 tokenId) 
        public view override(ERC721, ERC721URIStorage) returns (string memory) 
    {
        return super.tokenURI(tokenId);
    }

    // ✅ `_beforeTokenTransfer` 함수 수정 (ERC721Enumerable 적용)
    function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize) 
        internal override(ERC721, ERC721Enumerable) 
    {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    // ✅ `supportsInterface` 함수 수정 (올바른 오버라이딩)
    function supportsInterface(bytes4 interfaceId) 
        public view override(ERC721, ERC721Enumerable, ERC721URIStorage) returns (bool) 
    {
        return super.supportsInterface(interfaceId);
    }

    // ✅ `_burn` 함수 수정 (ERC721URIStorage 상속 적용)
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    // ✅ NFT 가격 조회
    function getNFTPrice(uint256 tokenId) external view returns (uint256) {
        require(_exists(tokenId), "NFT does not exist");
        return nftPrices[tokenId];
    }

    function listNFTForSale(uint256 tokenId) external onlyOwner {
        require(_exists(tokenId), "NFT does not exist");
        require(ownerOf(tokenId) == msg.sender, "Not the owner");
        require(!isNFTForSale[tokenId], "NFT is already listed for sale"); // ✅ 이미 판매 중인지 확인
        isNFTForSale[tokenId] = true; // ✅ 판매 상태 업데이트
        }
    }

const NFT_CONTRACT_ADDRESS = "0xdb1b7d8aedc830825836790b125fff3773382d6b";
const GANACHE_RPC_URL = "http://127.0.0.1:7545";

let provider, signer, nftContract, currentAccount;

const ABI_NFT = [
    {
        "inputs": [{ "internalType": "address", "name": "user", "type": "address" }],
        "name": "getOwnedNFTs",
        "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
        "name": "getNFTInfo",
        "outputs": [
            { "internalType": "string", "name": "name", "type": "string" },
            { "internalType": "string", "name": "description", "type": "string" },
            { "internalType": "string", "name": "tokenURI", "type": "string" },
            { "internalType": "uint256", "name": "price", "type": "uint256" },
            { "internalType": "bool", "name": "isForSale", "type": "bool" }  // ✅ 판매 여부 추가
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
        "name": "ownerOf",  // ✅ ERC-721 표준 함수
        "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
        "name": "listNFTForSale",  // ✅ 가격 입력 없이 등록 가능
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];


async function connectWallet() {
    if (!window.ethereum) {
        alert("🚨 MetaMask가 설치되어 있지 않습니다!");
        return;
    }

    provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();
    currentAccount = await signer.getAddress();
    nftContract = new ethers.Contract(NFT_CONTRACT_ADDRESS, ABI_NFT, signer);

    document.getElementById("walletAddress").textContent = `🔗 ${currentAccount}`;
    await loadOwnedNFTs();
}

// ✅ IPFS URL 변환 함수 추가
function formatIPFSUrl(ipfsURI) {
    if (!ipfsURI) return "";
    if (ipfsURI.startsWith("ipfs://")) {
        return ipfsURI.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
    }
    return ipfsURI;
}

// ✅ NFT 메타데이터에서 이미지 가져오기
async function fetchImageFromMetadata(tokenURI) {
    console.log(`🔍 Fetching metadata from: ${tokenURI}`);

    try {
        const formattedURI = formatIPFSUrl(tokenURI);
        const response = await fetch(formattedURI);
        if (!response.ok) throw new Error(`Failed to fetch metadata: ${response.status}`);
        const metadata = await response.json();

        let imageUrl = metadata.image || "https://dummyimage.com/250x250/cccccc/000000.png&text=No+Image";
        if (imageUrl.startsWith("ipfs://")) {
            imageUrl = formatIPFSUrl(imageUrl);
        }

        return imageUrl;
    } catch (error) {
        console.error("❌ NFT 메타데이터 로드 오류:", error);
        return "https://dummyimage.com/250x250/cccccc/000000.png&text=No+Image";
    }
}

async function loadOwnedNFTs() {
    console.log(`📌 현재 연결된 계정: ${currentAccount}`);
    console.log("📌 NFT 소유권 조회 시작...");

    const nftList = document.getElementById("nftList");
    nftList.innerHTML = ""; // 기존 목록 초기화

    try {
        console.log(`📌 NFT 스마트 컨트랙트 주소: ${NFT_CONTRACT_ADDRESS}`);

        const formattedAddress = ethers.utils.getAddress(currentAccount);
        const tokenIds = await nftContract.getOwnedNFTs(formattedAddress);

        console.log(`✅ 보유한 NFT 개수: ${tokenIds.length}`);

        if (tokenIds.length === 0) {
            nftList.innerHTML = `<p>📭 보유한 NFT가 없습니다.</p>`;
            return;
        }

        for (const tokenId of tokenIds) {
            try {
                const [name, description, tokenURI, price] = await nftContract.getNFTInfo(tokenId);
                console.log(`📌 NFT ID: ${tokenId}, Name: ${name}`);

                // ✅ NFT 이미지 가져오기
                const imageUrl = await fetchImageFromMetadata(tokenURI);

                const nftItem = document.createElement("div");
                nftItem.classList.add("nft-item");
                nftItem.innerHTML = `
                    <img src="${imageUrl}" width="200" onerror="this.onerror=null;this.src='https://dummyimage.com/250x250/cccccc/000000.png&text=No+Image';">
                    <p><strong>이름:</strong> ${name}</p>
                    <button class="btn btn-info" onclick="toggleDescription(${tokenId})">📜 설명 보기</button>
                    <p id="desc-${tokenId}" class="hidden"><strong>설명:</strong> ${description}</p>
                    <p><strong>가격:</strong> ${ethers.utils.formatEther(price)} GTN</p>
                    <button class="btn btn-success" onclick="listNFTForSale(${tokenId})">💰 판매 등록</button>
                `;
                nftList.appendChild(nftItem);
            } catch (err) {
                console.error(`🚨 NFT 정보 불러오기 실패 (Token ID: ${tokenId}):`, err);
            }
        }
    } catch (error) {
        console.error("🚨 NFT 소유권 조회 실패:", error);
        alert("🚨 NFT 소유권 조회 중 오류 발생! 로그를 확인하세요.");
    }
}

// ✅ 설명 토글 함수 추가
function toggleDescription(tokenId) {
    const descElement = document.getElementById(`desc-${tokenId}`);
    if (descElement) {
        descElement.classList.toggle("hidden");
    }
}

async function listNFTForSale(tokenId) {
    try {
        console.log(`📌 NFT #${tokenId} 판매 등록 요청`);

        // ✅ 최신 NFT 정보 가져오기 (isForSale 값 확인)
        const [name, description, tokenURI, price, isForSale] = await nftContract.getNFTInfo(tokenId);

        console.log(`🔍 NFT #${tokenId}의 소유자: ${currentAccount}`);
        console.log(`🛒 현재 판매 상태 (스마트 컨트랙트 반환 값): ${isForSale}`);

        // ✅ 만약 isForSale이 true라면, 실제 스마트 컨트랙트에서 확인하여 검증
        if (isForSale) {
            const txReceipt = await provider.getTransactionReceipt(NFT_CONTRACT_ADDRESS);
            if (!txReceipt || !txReceipt.logs.length) {
                alert("🚨 오류: 실제 판매 상태가 다를 수 있습니다. 다시 확인하세요.");
                return;
            }
            console.log("🛒 실제 트랜잭션 로그 확인 완료!");
        }

        // ✅ 관리자 확인
        const owner = await nftContract.ownerOf(tokenId);
        if (owner.toLowerCase() !== currentAccount.toLowerCase()) {
            alert("🚨 관리자만 판매 등록할 수 있습니다!");
            return;
        }

        // ✅ 트랜잭션 실행
        const tx = await nftContract.listNFTForSale(tokenId);
        await tx.wait();

        alert(`✅ NFT #${tokenId}이 판매 목록에 등록되었습니다.`);
        loadOwnedNFTs();
    } catch (error) {
        console.error("🚨 판매 등록 실패:", error);
        alert("🚨 NFT 판매 등록 중 오류 발생!");
    }
}



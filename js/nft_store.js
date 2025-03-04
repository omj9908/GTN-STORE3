const NFT_CONTRACT_ADDRESS = "0xdb1b7d8aedc830825836790b125fff3773382d6b"; 
const GTN_CONTRACT_ADDRESS = "0x196fb30137b1410b96bcb8753bc90be021885f33"; 

const GANACHE_RPC_URL = "http://127.0.0.1:7545";

let provider, signer, nftContract, gtnTokenContract, currentAccount;

const ABI_GTN = [
    {
        "inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
        "name": "balanceOf",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "address", "name": "recipient", "type": "address" },
            { "internalType": "uint256", "name": "amount", "type": "uint256" }
        ],
        "name": "transfer",
        "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "address", "name": "owner", "type": "address" },
            { "internalType": "address", "name": "spender", "type": "address" }
        ],
        "name": "allowance",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "address", "name": "spender", "type": "address" },
            { "internalType": "uint256", "name": "amount", "type": "uint256" }
        ],
        "name": "approve",
        "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

const ABI_NFT = [
    {
        "inputs": [],
        "name": "getNFTsForSale",
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
            { "internalType": "bool", "name": "isForSale", "type": "bool" },
            { "internalType": "address", "name": "seller", "type": "address" } // ✅ 판매자 주소 추가
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
        "name": "ownerOf",  // ✅ 추가
        "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
        "name": "buyNFT",
        "outputs": [],
        "stateMutability": "payable",
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
    gtnTokenContract = new ethers.Contract(GTN_CONTRACT_ADDRESS, ABI_GTN, signer); // ✅ 변경된 ABI 적용

    document.getElementById("walletAddress").textContent = `🔗 ${currentAccount}`;
    
    await checkGTNBalance();
    await loadMarketplaceNFTs();
}

async function checkGTNBalance() {
    if (!gtnTokenContract) {
        gtnTokenContract = new ethers.Contract(GTN_CONTRACT_ADDRESS, ABI_GTN, signer);
    }

    const balanceElement = document.getElementById("gtnBalance");
    if (!balanceElement) {
        console.warn("🚨 gtnBalance 요소를 찾을 수 없습니다. HTML을 확인하세요.");
        return;
    }

    try {
        const balance = await gtnTokenContract.balanceOf(currentAccount);
        const formattedBalance = ethers.utils.formatEther(balance);

        balanceElement.textContent = `GTN 잔액: ${formattedBalance} GTN`;

        // ✅ 추가된 GTN 잔액 표시 코드
        document.getElementById("gtnBalance").textContent = `GTN 잔액: ${formattedBalance} GTN`;

    } catch (error) {
        console.error("🚨 GTN 잔액 조회 실패:", error);
    }
}

function formatIPFSUrl(ipfsURI) {
    if (!ipfsURI) return "";
    if (ipfsURI.startsWith("ipfs://")) {
        return ipfsURI.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
    }
    return ipfsURI;
}

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

async function loadMarketplaceNFTs() {
    console.log("📌 판매 중인 NFT 목록 불러오기...");

    const nftList = document.getElementById("nftList");
    nftList.innerHTML = "";

    try {
        const tokenIds = await nftContract.getNFTsForSale();

        console.log(`🛒 판매 중인 NFT 개수 (조회된 전체): ${tokenIds.length}`);

        for (const tokenId of tokenIds) {
            const [name, description, tokenURI, price, isForSale] = await nftContract.getNFTInfo(tokenId);

            if (!isForSale) continue;

            const imageUrl = await fetchImageFromMetadata(tokenURI);

            const nftItem = document.createElement("div");
            nftItem.classList.add("nft-item");
            nftItem.innerHTML = `
                <img src="${imageUrl}" width="200">
                <p><strong>이름:</strong> ${name}</p>
                <p><strong>설명:</strong> ${description}</p>
                <p><strong>가격:</strong> ${ethers.utils.formatEther(price)} GTN</p>
                <button class="btn btn-success" onclick="buyNFT(${tokenId}, ${price})">🛒 구매하기</button>
            `;
            nftList.appendChild(nftItem);
        }
    } catch (error) {
        console.error("🚨 판매 목록 불러오기 실패:", error);
    }
}

async function buyNFT(tokenId, price) {
    try {
        console.log(`📌 NFT #${tokenId} 구매 요청 (GTN 토큰 사용)`);

        const [name, description, tokenURI, currentPrice, isForSale] = await nftContract.getNFTInfo(tokenId);
        if (!isForSale) {
            alert("🚨 상품이 이미 판매 완료되었습니다!");
            return;
        }

        const buyerBalance = await gtnTokenContract.balanceOf(currentAccount);
        const priceInWei = ethers.utils.parseEther(ethers.utils.formatEther(currentPrice.toString()));

        if (buyerBalance.lt(priceInWei)) {
            alert("❌ 보유한 GTN 토큰이 부족합니다!");
            return;
        }

        console.log("✅ GTN 전송 승인 요청...");
        const approveTx = await gtnTokenContract.approve(NFT_CONTRACT_ADDRESS, priceInWei);
        await approveTx.wait();
        console.log("✅ GTN 사용 승인 완료!");

        console.log("🚀 NFT 구매 진행 중...");
        const buyTx = await nftContract.buyNFT(tokenId);
        await buyTx.wait();

        console.log(`✅ NFT #${tokenId} 구매 성공!`);
        alert(`✅ NFT #${tokenId} 구매 성공!`);
        await checkGTNBalance();
        await loadMarketplaceNFTs();
    } catch (error) {
        console.error("🚨 GTN 구매 실패:", error);

        if (error.data?.message) {
            alert(`🚨 오류 발생: ${error.data.message}`);
        } else {
            alert("🚨 NFT 구매 중 예상치 못한 오류가 발생했습니다!");
        }
    }
}

async function checkIfAdmin() {
    try {
        if (!provider) provider = new ethers.providers.Web3Provider(window.ethereum);
        if (!signer) signer = provider.getSigner();

        const contract = new ethers.Contract(NFT_CONTRACT_ADDRESS, ABI_NFT, provider);

        let ownerAddress;
        if (contract.owner) {
            ownerAddress = await contract.owner(); // ✅ `Ownable` 컨트랙트가 있을 경우
        } else if (contract.ownerOf) {
            const adminTokenId = 1; // ✅ 특정 NFT ID 소유자를 조회 (관리자가 해당 NFT를 보유한다고 가정)
            ownerAddress = await contract.ownerOf(adminTokenId);
        } else {
            throw new Error("🚨 컨트랙트에 owner() 또는 ownerOf() 함수가 없음");
        }

        const currentAccount = await signer.getAddress();

        console.log("🔍 [관리자 확인] 컨트랙트 소유자:", ownerAddress);
        console.log("🔍 [관리자 확인] 현재 연결된 계정:", currentAccount);

        if (ownerAddress.toLowerCase() === currentAccount.toLowerCase()) {
            document.getElementById("go-nft-manage-btn").style.display = "block"; // ✅ 관리자 버튼 표시
            console.log("✅ 관리자 계정입니다. 버튼 표시");
        } else {
            document.getElementById("go-nft-manage-btn").style.display = "none";  // ❌ 일반 사용자는 버튼 숨김
            console.log("❌ 일반 사용자입니다. 버튼 숨김");
        }
    } catch (error) {
        console.error("🚨 관리자 확인 중 오류 발생:", error);
    }
}

function logout() {
    console.log("🚪 로그아웃 실행");

    document.getElementById("walletAddress").textContent = "로그아웃됨";

    alert("로그아웃 되었습니다!");
    window.location.href = "login.html"; 
}

window.onload = async function () {
    await connectWallet();
    window.logout = logout;
};

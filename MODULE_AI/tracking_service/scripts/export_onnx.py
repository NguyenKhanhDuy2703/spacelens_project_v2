import logging

import torch
import torchreid

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")


def export_model():
    onnx_path = "weights/osnet_x1_0.onnx"

    try:
        logging.info("Downloading OSNet Model...")
        model = torchreid.models.build_model(
            name='osnet_x1_0',
            num_classes=1000,
            loss='softmax',
            pretrained=True
        )
        model.eval()

        # OSNet standard input size is 256x128 (HxW)
        dummy_input = torch.randn(1, 3, 256, 128)

        logging.info(f"Exporting to {onnx_path}...")
        torch.onnx.export(
            model,
            dummy_input,
            onnx_path,
            export_params=True,
            opset_version=11,
            do_constant_folding=True,
            input_names=['input'],
            output_names=['output']
        )
        logging.info("Success! ONNX file is ready for OpenVINO.")
    except Exception as e:
        logging.error(f"An error occurred during the export process: {str(e)}")


if __name__ == "__main__":
    export_model()

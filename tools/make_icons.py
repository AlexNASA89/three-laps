"""30 значков-машинок из готовых вырезок проекта (временно, потом заменим на свои/свободные) -> three_laps/icons/cars/NN.webp (нос вправо)."""
import os, json
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PR = os.path.join(ROOT, "..")
SRC = """barracuda71_s1/broll_assets/cutouts/cuda70_red_brochure_noseL.png
barracuda71_s1/broll_assets/cutouts/cuda71_icon_blue_noseR.png
barracuda71_s1/broll_assets/cutouts/cuda71_ours_side_hoc_noseL.png
camaro_1/broll_assets/cutouts/camaro67_rs_streetside_noseL.png
camaro_1/broll_assets/cutouts/camaro69_pacecar_streetside_noseL.png
camaro_1/broll_assets/cutouts/camaro69_ss396_streetside_noseL.png
camaro_1/broll_assets/cutouts/camaro69_z28_streetside_noseL.png
camaro_1/broll_assets/cutouts/camaro70_z28_streetside_noseL.png
camaro_1/broll_assets/cutouts/firebird69_streetside_noseL.png
camaro_1/broll_assets/cutouts/javelin69_sst_streetside_noseL.png
camaro_1/broll_assets/cutouts/mustang65_coupe_streetside_noseL.png
corvette68_1/broll_assets/cutouts/boss302_69_streetside.png
corvette68_1/broll_assets/cutouts/c2_64_coupe_gateway.png
corvette68_1/broll_assets/cutouts/c2_67_conv_rallyred_streetside.png
corvette68_1/broll_assets/cutouts/c3_68_002.png
corvette68_1/broll_assets/cutouts/c3_68_002_gray.png
corvette68_1/broll_assets/cutouts/c3_68_002_green.png
corvette68_1/broll_assets/cutouts/c3_68_002_yellow.png
corvette68_1/broll_assets/cutouts/c3_69_conv_427_gateway.png
dart71_1/broll_assets/cutouts/challenger23_swinger_streetside.png
dart71_1/broll_assets/cutouts/challenger71_rt_green_streetside.png
dart71_1/broll_assets/cutouts/challenger71_rt_streetside.png
dart71_1/broll_assets/cutouts/dart71_swinger_hoc.png
dart71_1/broll_assets/cutouts/duster71_340_streetside.png
dart71_1/broll_assets/cutouts/maverick70_streetside.png
olds442_2/broll_assets/cutouts/eldorado72_conv_gateway.png
olds442_2/broll_assets/cutouts/eldorado76_conv_streetside.png
olds442_2/broll_assets/cutouts/gto64_conv_streetside.png
olds442_2/broll_assets/cutouts/olds442_70_conv_streetside.png
olds442_2/broll_assets/cutouts/olds442_70_w30_conv_streetside.png""".split("\n")
out = os.path.join(ROOT, "icons", "cars"); os.makedirs(out, exist_ok=True)
for i, rel in enumerate(SRC):
    im = Image.open(os.path.join(PR, rel)).convert("RGBA"); im = im.crop(im.getchannel("A").getbbox())
    if "noseL" in rel: im = im.transpose(Image.FLIP_LEFT_RIGHT)
    h = 96; im = im.resize((round(im.width * h / im.height), h), Image.LANCZOS)
    im.save(os.path.join(out, "%02d.webp" % i), "WEBP", quality=85, method=6)
print(len(SRC), "icons", sum(os.path.getsize(os.path.join(out, f)) for f in os.listdir(out)) // 1024, "KB")

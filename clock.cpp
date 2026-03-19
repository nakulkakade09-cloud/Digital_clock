#include <iostream>
#include <iomanip>
#include <ctime>
#include <fstream>
#include <windows.h>

using namespace std;

void saveTime(int h,int m,int s)
{
    ofstream file("clock_data.txt", ios::app);

    file << setw(2) << setfill('0') << h << ":"
         << setw(2) << m << ":"
         << setw(2) << s << endl;

    file.close();
}

int main()
{
    while(true)
    {
        time_t now = time(0);
        tm *ltm = localtime(&now);

        int h = ltm->tm_hour;
        int m = ltm->tm_min;
        int s = ltm->tm_sec;

        system("cls");

        cout << "DIGITAL CLOCK\n\n";

        cout << setw(2) << setfill('0') << h << ":"
             << setw(2) << m << ":"
             << setw(2) << s << endl;

        saveTime(h,m,s);

        Sleep(1000);
    }

    return 0;
}